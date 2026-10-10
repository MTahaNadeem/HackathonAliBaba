/**
 * lib/ingestion/pipeline.ts
 *
 * Core ingestion pipeline: fetches official source pages, runs per-source
 * parsers, and writes results to Postgres via the Supabase service-role client.
 *
 * SAFETY CONTRACT:
 * - A ParseFailure from any parser is logged to ingestion_runs.errors but
 *   NEVER overwrites the existing DB value. Good data is preserved on failure.
 * - Only ParseResult (ok: true) records are written to admission_cycles.
 * - The pipeline calls mark_stale_records() after every run to keep
 *   verification_status current.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { politeFetch } from './fetch';
import { parseNustFeePage } from './parsers/nust-fee-page';
import type {
  SourceEntry,
  ParseOutcome,
  IngestionRecord,
} from './types';

// Dynamic import of source list (JSON)
import sourceList from './source-list.json' with { type: 'json' };

/** How old (days) before a record is marked stale */
const STALE_THRESHOLD_DAYS = 90;

export interface RunResult {
  records_attempted: number;
  records_updated: number;
  records_failed: number;
  records_skipped: number;
  errors: Array<{ programme_id: string; error: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

function getServiceClient(): AnyClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for the ingestion pipeline. ' +
        'Set it in .env.local (never prefix with NEXT_PUBLIC_).',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } }) as AnyClient;
}

function getParser(
  parserName: string,
): ((html: string, programmeId: string, sourceUrl: string) => ParseOutcome) | null {
  switch (parserName) {
    case 'nust-fee-page':
      return parseNustFeePage;
    default:
      return null;
  }
}

/**
 * Process a single source entry: fetch its page and run the parser.
 * Returns an IngestionRecord with either a ParseResult or ParseFailure.
 */
async function processEntry(entry: SourceEntry): Promise<IngestionRecord> {
  if (!entry.parser || !entry.fee_source_url) {
    return {
      programme_id: entry.programme_id,
      outcome: {
        ok: false,
        error: `Skipped: no parser or fee_source_url defined for ${entry.programme_id}`,
        source_url: entry.fee_source_url ?? entry.official_admissions_url,
        retrieved_at: new Date().toISOString(),
      },
    };
  }

  const parserFn = getParser(entry.parser);
  if (!parserFn) {
    return {
      programme_id: entry.programme_id,
      outcome: {
        ok: false,
        error: `Unknown parser '${entry.parser}' for ${entry.programme_id}`,
        source_url: entry.fee_source_url,
        retrieved_at: new Date().toISOString(),
      },
    };
  }

  let html: string;
  try {
    html = await politeFetch(entry.fee_source_url);
  } catch (err) {
    return {
      programme_id: entry.programme_id,
      outcome: {
        ok: false,
        error: `Fetch failed for ${entry.fee_source_url}: ${String(err)}`,
        source_url: entry.fee_source_url,
        retrieved_at: new Date().toISOString(),
      },
    };
  }

  const outcome = parserFn(html, entry.programme_id, entry.fee_source_url);
  return { programme_id: entry.programme_id, outcome };
}

/**
 * Write a successful parse result to admission_cycles.
 * Uses upsert on (programme_id, academic_year) — safe to re-run.
 * NEVER called for ParseFailure outcomes.
 */
async function writeResult(
  db: AnyClient,
  entry: SourceEntry,
  result: Extract<ParseOutcome, { ok: true }>,
): Promise<void> {
  const academicYear = result.fees.academic_year ?? 'current';

  const { error } = await db.from('admission_cycles').upsert(
    {
      programme_id: entry.programme_id,
      academic_year: academicYear,
      source_url: result.source_url,
      checked_at: result.retrieved_at.slice(0, 10), // date portion
      last_verified_at: result.retrieved_at,
      verified: true,
      verification_status: 'source_backed',
      tuition_per_semester: result.fees.tuition_per_semester,
      mandatory_per_semester: result.fees.mandatory_per_semester,
      fee_currency: result.fees.fee_currency,
      fee_period: result.fees.fee_period,
      fee_mandatory_description: result.fees.fee_mandatory_description,
      rules: result.admission.rules,
      historical_merit: result.admission.historical_merit,
    },
    { onConflict: 'programme_id,academic_year' },
  );

  if (error) {
    throw new Error(
      `DB write failed for ${entry.programme_id}: ${error.message}`,
    );
  }

  // Also update the programme's last_verified_at
  await db
    .from('programmes')
    .update({
      last_verified_at: result.retrieved_at,
      verification_status: 'source_backed',
      source_url: result.source_url,
    })
    .eq('id', entry.programme_id);
}

/**
 * Run the full ingestion pipeline.
 * Returns a RunResult summary.
 * trigger: 'cron' | 'manual' | 'test'
 */
export async function runIngestionPipeline(
  trigger: 'cron' | 'manual' | 'test' = 'cron',
): Promise<RunResult> {
  const db = getServiceClient();
  const startedAt = new Date().toISOString();

  // Log the run start
  const { data: runData, error: runCreateError } = await db
    .from('ingestion_runs')
    .insert({
      started_at: startedAt,
      trigger,
      records_attempted: 0,
      records_updated: 0,
      records_failed: 0,
      records_skipped: 0,
      errors: [],
    })
    .select('id')
    .single();

  if (runCreateError || !runData) {
    // Cannot log run — proceed but note the issue
    console.error('[ingestion] Failed to create run log:', runCreateError?.message);
  }

  const runId: string | null = runData?.id ?? null;

  // Only process entries that have a parser defined
  const entries = (sourceList as SourceEntry[]).filter((e) => e.parser !== null);
  const skipped = (sourceList as SourceEntry[]).length - entries.length;

  const results: IngestionRecord[] = [];
  for (const entry of entries) {
    console.log(`[ingestion] Processing ${entry.programme_id} via ${entry.parser}`);
    const record = await processEntry(entry);
    results.push(record);
  }

  let updated = 0;
  let failed = 0;
  const errors: Array<{ programme_id: string; error: string }> = [];

  for (const record of results) {
    if (record.outcome.ok) {
      try {
        const entry = (sourceList as SourceEntry[]).find(
          (e) => e.programme_id === record.programme_id,
        )!;
        await writeResult(db, entry, record.outcome);
        updated++;
        console.log(`[ingestion] ✓ Updated ${record.programme_id}`);
      } catch (err) {
        failed++;
        const msg = String(err);
        errors.push({ programme_id: record.programme_id, error: msg });
        console.error(`[ingestion] ✗ DB write failed for ${record.programme_id}: ${msg}`);
      }
    } else {
      failed++;
      errors.push({
        programme_id: record.programme_id,
        error: record.outcome.error,
      });
      console.warn(
        `[ingestion] ✗ Parse failed for ${record.programme_id}: ${record.outcome.error}`,
        '→ Existing DB value preserved.',
      );
    }
  }

  // Mark stale records (any source_backed record not updated in 90 days)
  try {
    await db.rpc('mark_stale_records', { threshold_days: STALE_THRESHOLD_DAYS });
  } catch (err) {
    console.warn('[ingestion] mark_stale_records failed:', err);
  }

  const finishedAt = new Date().toISOString();
  const summary: RunResult = {
    records_attempted: entries.length,
    records_updated: updated,
    records_failed: failed,
    records_skipped: skipped,
    errors,
  };

  // Update the run log
  if (runId) {
    await db
      .from('ingestion_runs')
      .update({
        finished_at: finishedAt,
        records_attempted: summary.records_attempted,
        records_updated: summary.records_updated,
        records_failed: summary.records_failed,
        records_skipped: summary.records_skipped,
        errors: summary.errors,
      })
      .eq('id', runId);
  }

  return summary;
}
