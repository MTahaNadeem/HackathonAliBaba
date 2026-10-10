/**
 * lib/ingestion/types.ts
 *
 * Shared types for the ingestion pipeline.
 * NEVER invent, guess, or fabricate a fee, admission cutoff, or merit rule.
 * Every value must come from an official source page; store source_url + retrieved_at.
 */

export type VerificationStatus = 'source_backed' | 'needs_information' | 'stale';

/** A single source entry from source-list.json */
export interface SourceEntry {
  university_id: string;
  campus_id: string;
  programme_id: string;
  university_name: string;
  short: string;
  city: string;
  programme_title: string;
  degree_id: string;
  official_admissions_url: string;
  fee_source_url: string | null;
  eligibility_url: string | null;
  merit_url: string | null;
  /** Identifies which parser module to use. null = not yet implemented; skip. */
  parser: string | null;
  notes: string;
}

/** What a parser returns for a single programme's fees.
 * ALL fields are nullable — if the parser cannot reliably extract a value,
 * it must return null rather than guess. null values are stored with
 * verification_status = 'needs_information'. */
export interface ParsedFees {
  tuition_per_semester: number | null;
  mandatory_per_semester: number | null;
  fee_currency: string;
  fee_period: 'semester' | 'year' | 'programme';
  fee_mandatory_description: string | null;
  academic_year: string | null;
}

/** What a parser returns for admission rules.
 * Return null fields rather than guessing. */
export interface ParsedAdmission {
  rules: Record<string, unknown>;
  historical_merit: Record<string, unknown> | null;
}

/** Combined result of a parser run */
export interface ParseResult {
  ok: true;
  fees: ParsedFees;
  admission: ParsedAdmission;
  source_url: string;
  retrieved_at: string; // ISO-8601 UTC
}

/** Represents a parse failure — existing DB data must NOT be overwritten */
export interface ParseFailure {
  ok: false;
  error: string;
  source_url: string;
  retrieved_at: string;
}

export type ParseOutcome = ParseResult | ParseFailure;

/** Result of processing one SourceEntry through the pipeline */
export interface IngestionRecord {
  programme_id: string;
  outcome: ParseOutcome;
}
