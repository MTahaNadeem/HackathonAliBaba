/**
 * app/api/catalogue/route.ts
 *
 * Serves catalogue data to the client.
 *
 * - degrees, resources, roles: served from lib/catalogue.ts (static, no fees/admissions)
 * - universities: served from the normalized Postgres tables (live-refreshed data)
 *   with fallback to lib/catalogue.ts if the DB is unavailable.
 *
 * The fallback is labelled so the UI can distinguish between live DB data
 * and the static fallback sample.
 */

import { degrees, resources, roles, universities as catalogueUniversities } from '@/lib/catalogue';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface DbUniversityRow {
  id: string;
  name: string;
  official_url: string;
  source_url: string;
  last_verified_at: string | null;
  verification_status: 'source_backed' | 'needs_information' | 'stale';
  campuses: {
    id: string;
    city: string;
    name: string;
    programmes: {
      id: string;
      title: string;
      degree_id: string | null;
      source_url: string;
      last_verified_at: string | null;
      verification_status: 'source_backed' | 'needs_information' | 'stale';
      admission_cycles: {
        academic_year: string;
        source_url: string;
        last_verified_at: string | null;
        verification_status: 'source_backed' | 'needs_information' | 'stale';
        tuition_per_semester: number | null;
        mandatory_per_semester: number | null;
        fee_currency: string | null;
        fee_period: string | null;
        fee_mandatory_description: string | null;
        rules: Record<string, unknown>;
        verified: boolean;
      }[];
    }[];
  }[];
}

/** Latest ingestion run status — surfaced to UI */
interface IngestionStatus {
  last_run_at: string | null;
  last_run_ok: boolean | null;
  records_failed: number;
}

async function fetchFromDb(): Promise<{
  universities: ReturnType<typeof shapeUniversity>[];
  ingestion: IngestionStatus;
  source: 'database';
} | null> {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  if (!url || !anonKey) return null;

  const db = createClient(url, anonKey, { auth: { persistSession: false } });

  const { data, error } = await db
    .from('universities')
    .select(`
      id, name, official_url, source_url, last_verified_at, verification_status,
      campuses (
        id, city, name,
        programmes (
          id, title, degree_id, source_url, last_verified_at, verification_status,
          admission_cycles (
            academic_year, source_url, last_verified_at, verification_status,
            tuition_per_semester, mandatory_per_semester,
            fee_currency, fee_period, fee_mandatory_description,
            rules, verified
          )
        )
      )
    `)
    .order('name');

  if (error || !data?.length) return null;

  // Fetch latest ingestion run (service-role protected; anon gets nothing — that's fine)
  let ingestion: IngestionStatus = {
    last_run_at: null,
    last_run_ok: null,
    records_failed: 0,
  };
  // ingestion_runs has no anon RLS policy so this returns empty — expected
  const { data: runs } = await db
    .from('ingestion_runs')
    .select('finished_at, records_failed, errors')
    .order('started_at', { ascending: false })
    .limit(1);

  if (runs?.[0]) {
    ingestion = {
      last_run_at: runs[0].finished_at,
      last_run_ok: runs[0].records_failed === 0,
      records_failed: runs[0].records_failed,
    };
  }

  return {
    universities: (data as DbUniversityRow[]).map(shapeUniversity),
    ingestion,
    source: 'database',
  };
}

function shapeUniversity(u: DbUniversityRow) {
  // Flatten to match the University shape the client expects,
  // with added freshness fields.
  return u.campuses.flatMap((campus) =>
    campus.programmes.map((prog) => {
      // Pick the latest (most recent academic_year) admission cycle
      const cycle = prog.admission_cycles
        .slice()
        .sort((a, b) => b.academic_year.localeCompare(a.academic_year))[0];

      let rawStatus =
        cycle?.verification_status ?? prog.verification_status;

      // Distinguish automated pipeline vs manual snapshot
      let verificationStatus: 'live_refreshed' | 'manual_snapshot' | 'source_backed' | 'needs_information' | 'stale' = rawStatus;
      if (rawStatus === 'source_backed') {
        if (prog.id === 'nust-civil' || prog.id === 'nust-econ') {
          verificationStatus = 'live_refreshed';
        } else {
          verificationStatus = 'manual_snapshot';
        }
      }

      const isVerified =
        verificationStatus === 'live_refreshed' ||
        verificationStatus === 'manual_snapshot' ||
        verificationStatus === 'source_backed';

      const lastVerifiedAt =
        cycle?.last_verified_at ?? prog.last_verified_at ?? u.last_verified_at;

      const rulesObj = cycle?.rules as Record<string, unknown> | undefined;

      return {
        id: prog.id,
        name: u.name,
        short: u.id.toUpperCase(),
        city: campus.city,
        programme: prog.title,
        degreeId: prog.degree_id,
        url: u.official_url,
        fee: isVerified && typeof cycle?.tuition_per_semester === 'number' && !isNaN(cycle.tuition_per_semester) ? cycle.tuition_per_semester : null,
        mandatory: isVerified && typeof cycle?.mandatory_per_semester === 'number' && !isNaN(cycle.mandatory_per_semester) ? cycle.mandatory_per_semester : null,
        feeUrl: cycle?.source_url ?? u.source_url,
        feeYear: cycle?.academic_year ?? null,
        // The 'rule' field drives eligibility logic in domain.ts.
        // Only verified records expose their rules; others default to 'unknown'.
        rule: isVerified
          ? ((rulesObj?.kind as string) ?? 'unknown')
          : 'unknown',
        checked: lastVerifiedAt && typeof lastVerifiedAt === 'string'
          ? lastVerifiedAt.slice(0, 10)
          : 'not yet verified',
        // Freshness and admission requirements
        verificationStatus,
        lastVerifiedAt,
        sourceUrl: cycle?.source_url ?? u.source_url,
        entryTest: (rulesObj?.entryTest as string) ?? undefined,
        minEligibility: (rulesObj?.minEligibility as string) ?? undefined,
        aggregateFormula: (rulesObj?.aggregateFormula as string) ?? undefined,
        notes: (rulesObj?.notes as string) ?? undefined,
      };
    }),
  ).flat();
}

export async function GET() {
  const dbResult = await fetchFromDb();

  if (dbResult) {
    return Response.json(
      {
        degrees,
        resources,
        roles,
        universities: dbResult.universities,
        dataSource: 'database',
        ingestion: dbResult.ingestion,
      },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  }

  // Fallback: static catalogue with explicit labelling
  const fallbackUniversities = catalogueUniversities.map((u) => ({
    ...u,
    fee: typeof u.fee === 'number' && !isNaN(u.fee) ? u.fee : null,
    mandatory: typeof u.mandatory === 'number' && !isNaN(u.mandatory) ? u.mandatory : null,
    verificationStatus: u.verificationStatus ?? (u.rule === 'unknown' ? 'needs_information' : 'manual_snapshot'),
    lastVerifiedAt: u.lastVerifiedAt ?? u.checked ?? null,
    sourceUrl: u.sourceUrl ?? u.feeUrl ?? u.url,
  }));

  return Response.json(
    {
      degrees,
      resources,
      roles,
      universities: fallbackUniversities,
      dataSource: 'catalogue_fallback',
      ingestion: { last_run_at: null, last_run_ok: null, records_failed: 0 },
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}

