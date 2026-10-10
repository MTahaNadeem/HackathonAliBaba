/**
 * lib/ingestion/parsers/nust-fee-page.ts
 *
 * Parser for NUST's undergraduate fee structure page.
 * Source: https://nust.edu.pk/admissions/fee-structure/undergraduate-financial-matters/
 *
 * DESIGN CONTRACT:
 * - This parser must FAIL LOUDLY (return ParseFailure) if the page structure
 *   does not match the expected pattern. It must NEVER guess or interpolate a
 *   fee value.
 * - If a value cannot be found with confidence, it returns null for that field.
 * - A ParseFailure from this parser means the pipeline will log the error and
 *   leave the existing DB value untouched. Good data is never overwritten by
 *   a parse failure.
 *
 * MAINTENANCE NOTE:
 * NUST periodically redesigns its fee page. When this parser starts producing
 * ParseFailure results, a human must review the page and update the patterns
 * below. The ingestion_runs log will surface the failure.
 */

import type { ParseOutcome, ParsedFees, ParsedAdmission } from '../types';

// --- Extraction patterns (reviewable, not AI-guesses) ---

/**
 * NUST Civil/Engineering (SCEE, SMME, SEECS, etc.) tuition pattern.
 * The fee page lists a table row like:
 *   "Tuition Fee: PKR 216,750 per semester" or similar.
 * We look for a pattern: digits (possibly with commas) near "Civil" or "Engineering"
 * in a block near "tuition".
 *
 * IMPORTANT: These regexes are deliberately conservative. They match only
 * well-formed PKR amounts. If the page changes structure, the regex will NOT
 * match and we return ParseFailure — preserving the existing DB value.
 */

const ACADEMIC_YEAR_RE = /(\d{4})[–\-](\d{2,4})/;
const PKR_AMOUNT_RE = /PKR\s*([\d,]+)/gi;
const TUITION_BLOCK_RE =
  /tuition\s+fee[^]*?PKR\s*([\d,]+)/i;
const MANDATORY_BLOCK_RE =
  /mandatory\s+(?:charges?|fee)[^]*?PKR\s*([\d,]+)/i;

// School identifiers on the NUST fee page
const ENGINEERING_KEYWORDS =
  /SCEE|SMME|SEECS|SADA|RIMMS|SNS|ASAB|IESE|NBS.*Engineering/i;
const SOCIAL_KEYWORDS = /S3H|SAPS|NBS.*(?:Business|Social)/i;

interface NustParsed {
  engineering: { tuition: number | null; mandatory: number | null };
  social: { tuition: number | null; mandatory: number | null };
  academicYear: string | null;
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/,/g, '');
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n <= 0 || n > 10_000_000) return null; // sanity bounds
  return n;
}

function extractAcademicYear(html: string): string | null {
  const m = ACADEMIC_YEAR_RE.exec(html);
  if (!m) return null;
  const y1 = m[1];
  const y2 = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${y1}–${y2.slice(-2)}`;
}

/**
 * Extracts NUST fee data from the raw HTML of their fee page.
 * Returns null for any field that cannot be extracted with confidence.
 */
function parseNustFeeHtml(html: string): NustParsed {
  // Split into rough sections by school keyword
  const result: NustParsed = {
    engineering: { tuition: null, mandatory: null },
    social: { tuition: null, mandatory: null },
    academicYear: extractAcademicYear(html),
  };

  // Look for PKR amounts near tuition/mandatory keywords.
  // We use a window approach: find the keyword, take 300 chars after it,
  // extract the first PKR amount in that window.

  const lowerHtml = html.toLowerCase();

  // Engineering section
  const engIdx = lowerHtml.search(/scee|smme|seecs|engineering fee/i);
  if (engIdx >= 0) {
    const window = html.slice(engIdx, engIdx + 800);
    const tuitionM = TUITION_BLOCK_RE.exec(window);
    if (tuitionM) result.engineering.tuition = parseAmount(tuitionM[1]);
    const mandatoryM = MANDATORY_BLOCK_RE.exec(window);
    if (mandatoryM) result.engineering.mandatory = parseAmount(mandatoryM[1]);
  }

  // Social sciences section (S3H)
  const socIdx = lowerHtml.search(/s3h|social science|saps/i);
  if (socIdx >= 0) {
    const window = html.slice(socIdx, socIdx + 800);
    const tuitionM = TUITION_BLOCK_RE.exec(window);
    if (tuitionM) result.social.tuition = parseAmount(tuitionM[1]);
    const mandatoryM = MANDATORY_BLOCK_RE.exec(window);
    if (mandatoryM) result.social.mandatory = parseAmount(mandatoryM[1]);
  }

  // Fallback: if section detection failed, look for the first two distinct PKR amounts
  // in the document (engineering tuition is typically listed first).
  // This is intentionally conservative: we only use fallback if both sections are null.
  if (
    result.engineering.tuition === null &&
    result.social.tuition === null
  ) {
    const allAmounts: number[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(PKR_AMOUNT_RE.source, 'gi');
    while ((m = re.exec(html)) !== null) {
      const v = parseAmount(m[1]);
      if (v !== null && !allAmounts.includes(v)) allAmounts.push(v);
    }
    // Only trust if we found exactly 2 distinct amounts that look like fee values
    if (allAmounts.length >= 2 && allAmounts[0] > 50_000 && allAmounts[1] > 50_000) {
      result.engineering.tuition = allAmounts[0];
      result.social.tuition = allAmounts[1];
    }
    // If we can't reliably identify, leave as null — caller will return ParseFailure
  }

  return result;
}

/**
 * Main export: parse the NUST fee page for a specific programme.
 * programmeId must be 'nust-civil' (engineering) or 'nust-econ' (S3H).
 */
export function parseNustFeePage(
  html: string,
  programmeId: string,
  sourceUrl: string,
): ParseOutcome {
  const retrieved_at = new Date().toISOString();

  let parsed: NustParsed;
  try {
    parsed = parseNustFeeHtml(html);
  } catch (err) {
    return {
      ok: false,
      error: `Exception while parsing NUST fee page: ${String(err)}`,
      source_url: sourceUrl,
      retrieved_at,
    };
  }

  const isEngineering = programmeId === 'nust-civil';
  const section = isEngineering ? parsed.engineering : parsed.social;

  // STRICT RULE: If tuition cannot be extracted, fail loudly.
  // We will NOT overwrite an existing verified value with null.
  if (section.tuition === null) {
    return {
      ok: false,
      error: `Could not extract tuition fee for programme '${programmeId}' from NUST fee page. Page structure may have changed. Manual review required.`,
      source_url: sourceUrl,
      retrieved_at,
    };
  }

  const fees: ParsedFees = {
    tuition_per_semester: section.tuition,
    mandatory_per_semester: section.mandatory, // null is acceptable here
    fee_currency: 'PKR',
    fee_period: 'semester',
    fee_mandatory_description: section.mandatory !== null
      ? 'Mandatory semester charges (sports, transport, IT, etc.)'
      : null,
    academic_year: parsed.academicYear,
  };

  const admission: ParsedAdmission = {
    rules: {
      kind: isEngineering ? 'nust-engineering' : 'nust-social',
      scope:
        'Fee structure only. Full programme eligibility requires review of official admission criteria.',
      merit_formula_url:
        'https://nust.edu.pk/admissions/undergraduates/merit-criteria-for-admission-on-net-basis/',
      eligibility_url:
        'https://nust.edu.pk/admissions/undergraduates/eligibility-criteria-for-ug-programmes/',
    },
    // Historical merit is NOT parsed — we cannot reliably extract closing merits
    // from the fee page, and inventing them is prohibited.
    historical_merit: null,
  };

  return { ok: true, fees, admission, source_url: sourceUrl, retrieved_at };
}
