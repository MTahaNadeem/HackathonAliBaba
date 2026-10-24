# Extension integration report

## Causes and changes

The extension previously pointed at localhost, stored sessions without refreshing them, shared local guest skills/jobs across accounts, and used only the latest roadmap as learning history. Its default guest skills could make results look personalized when they were not. Roadmap links carried skill lists rather than an account-owned analysis.

The worker now authenticates against the confirmed website origin using the existing Supabase provider, rotates refresh tokens, restricts stored credentials to trusted extension contexts, and revokes sessions on logout. Passwords are never persisted. Network failures retain refresh credentials for retry; invalid sessions require sign-in.

Protected APIs load the account profile, CV inference, manual claims and all saved plans. Required skills receive weight 2, preferred skills weight 1. Profile claims and completed learning contribute to coverage; inferred and in-progress skills remain distinct. Experience and qualifications are listed for separate review, not converted into a misleading overall hiring percentage. This is vocabulary-assisted analysis, not a claim of complete natural-language understanding.

Analyses and manual claims persist in additive, owner-protected tables. Reanalysis and the Saved tab recalculate scores using current history. The roadmap button saves target choices and opens only an analysis UUID. The server validates ownership and creates one stable plan or reopens the existing plan unchanged. New plans use existing resources and the current curriculum view with study, practice and project/self-assessment stages. All stages must be completed before a skill counts as learned. Lesson IDs link to exact milestones; opening a resource never completes it. Completion remains self-reported.

The latest remote Groq and curriculum commits were preserved during integration. Previously cancelled local roadmap edits remain separately archived and were not restored. Account plans no longer enter a shared guest browser cache, and queued website saves prevent rapid updates arriving in reverse order within a page. Cross-device simultaneous editing still uses the existing last-write-wins plan storage.

## Changed files

- `app/api/extension/auth/route.ts`, `profile/route.ts`, `analyses/route.ts`: account sessions, complete evidence, saved analyses and owned roadmap handoff.
- `lib/extension-http.ts`, `learning-memory.ts`, `account-job-analysis.ts`, `job-skills.ts`, `job-roadmap.ts`: shared API handling, evidence aggregation, scoring, vocabulary and curriculum mapping.
- `components/coursecompass-app.tsx`, `components/learning.tsx`: existing website handoff, account isolation, ordered saves and exact lesson progress mapping.
- `courseai-compass-extension/background.js`, `content.js`, `manifest.json`, `popup.html`, `popup.js`: MV3 session handling, permissions, job extraction/manual fallback, existing three-tab interface and account APIs.
- `supabase/migrations/004_extension_learning.sql`: additive tables and owner RLS policies.
- `tests/extension-integration.test.ts`, `tests/extension-routes.test.ts`, `tests/browser/extension.cjs`: evidence/session/API tests and browser fixtures.
- Extension `README.md` and this report: setup and verification instructions.

## Verification

- `npm test`: 133 tests passed, including the existing website suite and new learning-memory, refresh-session, authorization, idempotent roadmap and completion tests.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Chromium popup test: passed with simulated Chrome APIs/account responses. It covers invalid/valid login, reopen, profile loading, manual analysis, private-ID handoff, logout and the real content extractor on Indeed-shaped and unsupported DOM fixtures.
- Actual worker JavaScript executes in VM tests for refresh rotation, expired sessions, network failure and rejection of content-script requests.
- `npm run lint`: still fails on 186 existing diagnostics versus 200 in an archived copy of remote baseline `bebeaac`; normalized comparison found no added diagnostics.
- `git diff --check`: passed.

Unverified: live existing-account authentication, executing SQL/RLS against Supabase, cross-device persistence, the complete live website completion journey, and current Indeed/LinkedIn pages. Managed Chromium rejects unpacked extension installation, and the network proxy rejected access to the deployed website. No live account or deployment verification is claimed.

## Required deployment steps

Apply migration 004 to the website's Supabase project, deploy the updated website using the existing Supabase environment configuration, and reload the unpacked extension. Test with the same account in the website and extension. No database migration or manual deployment was executed from this environment. GitHub push status and the final commit are reported separately in the chat.
