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

## Three Tiers of Data Freshness

To maintain honesty and prevent hallucination, data in CourseCompass AI is categorized into three explicit tiers:

1. **`live-refreshed` (2 entries in active automated pipeline):**
   - Automatically re-fetched on a weekly schedule (Sunday 02:00 UTC via Vercel Cron).
   - Validated by an automated, reviewable DOM parser.
   - Updated directly in Postgres if parser succeeds; untouched on parse failure.
2. **`manual-snapshot` (71 entries manually audited once):**
   - Manually audited against official published fee challans and prospectuses.
   - Currently have `parser: null` in `source-list.json`. They **do not auto-refresh** and will automatically flip to `stale` after 90 days via `mark_stale_records()`.
   - The UI explicitly badges them as `Manual snapshot · [date]` linking directly to the official university fee page so students know to verify live changes.
3. **`needs_information` (4 entries):**
   - Universities that do not publish a public open fee schedule (e.g. LSE Lahore, PAF-IAST, MUST AJK).
   - Stored with `fee: null` and badge `Check current admissions`. They never pass budget checks.

---

## 1. Live in Pipeline (`live-refreshed`)

| University | Campus | Programme | Fee Source URL | Parser | Status |
|-----------|--------|-----------|---------------|--------|--------|
| NUST | Islamabad | Civil engineering · SCEE | https://nust.edu.pk/admissions/fee-structure/undergraduate-financial-matters/ | `nust-fee-page` | `live-refreshed` |
| NUST | Islamabad | BS Economics · S3H | https://nust.edu.pk/admissions/fee-structure/undergraduate-financial-matters/ | `nust-fee-page` | `live-refreshed` |

**What "live-refreshed" means:** The scheduled pipeline fetches the fee source URL weekly, extracts the latest fee, and updates `admission_cycles`. The UI shows the real `last_verified_at` date from Postgres with a `Live-refreshed` badge.

---

## 2. Manually Verified Snapshots (`manual-snapshot` — 71 entries)

These entries were reviewed from official portals with explicit source citations. Because their parsers are not yet implemented (`parser: null`), **they will not auto-update**. If unrefreshed after 90 days, the database automatically marks them `stale`.

| University | Campus / City | Programme | Official Fee Source | Status |
|-----------|--------------|-----------|--------------------|--------|
| UET Lahore | Lahore | B.Sc. Civil Engineering | https://admission.uet.edu.pk/ | `manual-snapshot` |
| UET Lahore | Lahore | BS Computer Science | https://admission.uet.edu.pk/ | `manual-snapshot` |
| FAST-NUCES | Islamabad | BS Computer Science | https://www.nu.edu.pk/ | `manual-snapshot` |
| FAST-NUCES | Islamabad | BS Software Engineering | https://www.nu.edu.pk/ | `manual-snapshot` |
| COMSATS | Islamabad | BS Computer Science | https://www.comsats.edu.pk/ | `manual-snapshot` |
| COMSATS | Lahore | BS Electrical Engineering | https://lahore.comsats.edu.pk/ | `manual-snapshot` |
| Quaid-i-Azam University | Islamabad | BS Computer Science | https://qau.edu.pk/ | `manual-snapshot` |
| Quaid-i-Azam University | Islamabad | BS Economics | https://qau.edu.pk/ | `manual-snapshot` |
| Air University | Islamabad | BS Computer Science | https://www.au.edu.pk/ | `manual-snapshot` |
| Bahria University | Islamabad | BS Computer Science | https://www.bahria.edu.pk/ | `manual-snapshot` |
| PIEAS | Islamabad | BS Electrical Engineering | http://admissions.pieas.edu.pk/ | `manual-snapshot` |
| NCA | Lahore | Bachelor of Visual Communication | https://www.nca.edu.pk/ | `manual-snapshot` |
| NED UET | Karachi | BE Civil Engineering | https://www.neduet.edu.pk/ | `manual-snapshot` |
| Karachi University (UBIT) | Karachi | BS Computer Science | https://uok.edu.pk/ | `manual-snapshot` |
| Aga Khan University | Karachi | MBBS | https://www.aku.edu/ | `manual-snapshot` |
| Habib University | Karachi | BS Computer Science | https://habib.edu.pk/ | `manual-snapshot` |
| GIKI | Topi, KP | BS Computer Science | https://giki.edu.pk/ | `manual-snapshot` |
| UET Peshawar | Peshawar | B.Sc. Civil Engineering | https://www.uetpeshawar.edu.pk/ | `manual-snapshot` |
| BUITEMS | Quetta | BS Computer Science | https://www.buitms.edu.pk/ | `manual-snapshot` |
| *(and 52 more)* | Various | Various | Documented in `lib/catalogue.ts` & `source-list.json` | `manual-snapshot` |

---

## 3. Needs Information / Unpublished (`needs_information` — 4 entries)

| University | City | Programme | Official URL | Reason |
|-----------|------|-----------|-------------|--------|
| LSE Lahore | Lahore | BBA / BS Economics | https://admissions.lahoreschool.edu.pk/ | No public fee schedule online. Requires inquiry to admissions office. |
| PAF-IAST | Haripur | BS Artificial Intelligence | https://paf-iast.edu.pk/ | Public schedule not accessible without applicant login. |
| MUST | Mirpur, AJK | B.Sc. Electrical Engineering | https://must.edu.pk/ | Annual prospectus update pending. |
| Fatima Jinnah Medical Univ | Lahore | MBBS | https://fjmu.edu.pk/ | Centralized UHS Punjab merit quota. |


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
