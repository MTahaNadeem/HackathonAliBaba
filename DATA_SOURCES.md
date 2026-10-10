# DATA_SOURCES.md — CourseCompass AI University Data

This file is the authoritative record of which university/programme entries are
in the live refresh pipeline and which are documented but not yet source-backed.
Every entry that the pipeline is allowed to ingest must appear here with a
human-reviewed `fee_source_url` before a parser is written or enabled.

---

## How to add a new source

1. Find the official fee structure page on the university's website. Verify it
   is the primary published URL (not a mirror or cached copy).
2. Add a new JSON object to [`lib/ingestion/source-list.json`](lib/ingestion/source-list.json).
   Set `parser: null` initially.
3. Add a row to the **Not yet in pipeline** table below.
4. Write a new parser in `lib/ingestion/parsers/<university-slug>.ts` following
   the contract in [`lib/ingestion/types.ts`](lib/ingestion/types.ts):
   - Return `ParseFailure` (ok: false) if the page structure does not match
     your expected pattern.
   - Return `null` for any field you cannot extract with confidence.
   - Never guess or interpolate a number.
5. Set `parser: "<your-parser-name>"` in source-list.json.
6. Update this file: move the entry from **Not yet in pipeline** to **Live**.
7. Run `npm test` to verify parse-failure safety.

---

## Live in pipeline (ingestion active)

| University | Campus | Programme | Fee source URL | Parser | Verified |
|-----------|--------|-----------|---------------|--------|---------|
| NUST | Islamabad | Civil engineering · SCEE | https://nust.edu.pk/admissions/fee-structure/undergraduate-financial-matters/ | `nust-fee-page` | 2026-09-07 |
| NUST | Islamabad | BS Economics · S3H | https://nust.edu.pk/admissions/fee-structure/undergraduate-financial-matters/ | `nust-fee-page` | 2026-09-07 |

**What "live" means:** The pipeline fetches the fee source URL weekly (Sunday 02:00 UTC),
runs the parser, and writes the result to the `admission_cycles` table. The UI
shows the `last_verified_at` date from the database, not a hardcoded date in code.

---

## Not yet in pipeline (documented, needs human review)

| University | City | Programme | Official URL | What's needed before pipeline |
|-----------|------|-----------|-------------|-------------------------------|
| UET Lahore | Lahore | Engineering programmes | https://apply.uet.edu.pk/downloads | Locate specific fee page (not downloads index); write parser |
| IBA Karachi | Karachi | Undergraduate business & economics | https://admissions.iba.edu.pk/ | Locate fee structure URL; verify it's publicly accessible without login |
| NCA Lahore | Lahore | Arts & design | https://nca.edu.pk/ | Confirm current programme names; find fee schedule |

---

## Institutions considered but not yet added

The following institutions are on the HEC-recognized list and relevant to the
target student demographic. They are listed here for future prioritization.
None are in the codebase or database until a human reviewer adds them via the
process above.

| Institution | City | Notes |
|------------|------|-------|
| LUMS | Lahore | High fee; international comparison useful |
| FAST-NUCES | Multiple campuses | CS/Engineering focus; multiple cities |
| Aga Khan University | Karachi | Health sciences; competitive |
| University of Karachi | Karachi | Large public institution |
| Punjab University | Lahore | Large public institution |
| Quaid-i-Azam University | Islamabad | Sciences and social sciences |
| COMSATS | Multiple campuses | Engineering and CS; public |
| SZABIST | Karachi/Islamabad | Business and computing |
| Air University | Islamabad | Engineering and management |
| Bahria University | Multiple campuses | Engineering and computing |

---

## What the pipeline does NOT claim to provide

- **Closing merit / historical merit cutoffs:** Not parsed. The NUST fee page does
  not publish merit data; merit pages change structure frequently. Any closing
  merit in the system must be entered manually with a source citation.
- **Hostel / accommodation fees:** Not in scope. The UI explicitly excludes these.
- **All HEC-recognized institutions:** There are 200+ HEC-recognized universities.
  The pipeline covers a curated subset. The "live data" claim is accurate only
  for entries with `parser != null` in source-list.json.
- **Real-time admission status:** Admission windows open and close independently
  of fee structure. The pipeline verifies fees and known rules; it does not
  track open/closed status.

---

## Open data investigation summary (October 2026)

- **HEC:** No public API for fee or admission data. The [Pakistan Open Data Portal](https://opendata.com.pk/)
  has HEC-backed institutional lists (name, location, recognition status) as CSV,
  but no fee or admission data. Useful for verifying institution recognition status.
- **IBCC:** No open data API. Equivalence guidelines published as static web pages only.
  The existing `sourceLinks.ibcc` link in the app is the correct approach.
