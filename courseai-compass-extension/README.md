# CourseAI Compass extension

The existing Analyze, Saved and Profile tabs connect to **https://coursecompassai.vercel.app** using the website's Supabase accounts.

## Enable the integration

1. Apply `supabase/migrations/004_extension_learning.sql` to the same Supabase project as the website, after the existing migrations. It adds account-owned skill claims and job analyses with row-level security; existing profiles and plans are retained.
2. Deploy the updated website API with its existing Supabase URL and publishable/anon key configuration. No privileged key belongs in the extension.
3. Open `chrome://extensions`, enable Developer mode, and Load unpacked → this directory (or reload an existing installation).
4. Sign in through Profile with your website credentials. The website may separately ask you to sign in when opening a roadmap; use the same account.

To change the website origin, update `popup.js`, `background.js` and the host permission in `manifest.json` together. Never copy an authentication code or token into the configured URL.

## Continuous learning

- Profile sync loads saved profile/CV data and **all** account plans. Manual extension claims are stored separately in the database. Website profile skills are edited on the website; earned progress is never removed by deleting a manual claim.
- Analyze an individual, fully expanded Indeed/LinkedIn job posting. Extraction runs only after a click and reads job containers or JobPosting metadata. If the page is inaccessible or selectors change, use **Paste job description**.
- Signed-in analysis loads current account evidence on the server, saves the analysis, and shows required/preferred skill coverage. Required skills have weight 2; preferred skills weight 1. Profile claims and completed learning count; CV inference and in-progress learning do not count as completed. Formal experience/qualification requirements are shown for separate review; the percentage is not an overall hiring score.
- All missing skills are initially selected. You can change targets before the first roadmap is created; an existing roadmap always reopens with progress preserved.
- Build Learning Plan opens `/?analysis=<uuid>#roadmap`. The server checks ownership and reuses a saved plan. New missing skills receive study, practice and project/self-assessment stages using the existing resource catalogue and time estimates. Opening links does not mark completion.
- Update milestone status on the existing website roadmap. Completion is self-reported using the existing completion controls, not a verified examination. Every stage for a skill must be completed before that plan contributes completed evidence. Reanalysis reads the saved history again, including progress from other jobs.
- Saved analyses belong to the account. Reopening preserves the plan and its progress. Removing a saved analysis does not delete its learning plan. Guest skills/jobs remain local and are never silently merged into an account; guest data does not survive reinstall.

## Sessions and permissions

The Manifest V3 worker handles login, refresh-token rotation and session revocation through the website API. Passwords are never stored. Tokens live in Chrome extension local storage restricted to trusted extension contexts, never in URLs or job-page scripts. This is browser-managed storage, not an encrypted credential vault. Invalid refresh sessions require sign-in; temporary network failures preserve the session for retry.

Only `activeTab`, `scripting`, `storage`, and the website host permission are requested. No automatic all-sites content script is installed. Protected APIs use bearer authentication, user filters, and Supabase RLS. No service-role key is required.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` from the repository root. `node tests/browser/extension.cjs` is an optional Chromium/Playwright popup/extraction test using simulated Chrome APIs and test-only account fixtures, not real account credentials. Playwright and Chromium must be available in the environment.

Live Supabase authentication, migration/RLS execution, cross-device persistence and current third-party job-site markup require a deployed environment and test accounts. Passing mocked tests does not establish these live integrations. The analyser uses an explicit keyword vocabulary plus the existing job analysis service; ambiguous wording and unrecognized technologies need manual review.
