# Free-service setup

Raah has a conventional Next.js application plus a Sites/Vinext build adapter. Supabase PostgreSQL is the authoritative database for account profiles and learning plans. There is no SQLite replacement. Guest state is deliberately temporary and labelled.

## Run

Use Node 22.13 or later. Run `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Open the URL printed by Next.js. Never commit `.env.local`. `npm run build` and `npm start` run the conventional production Next.js application. `npm run dev:sites` / `npm run build:sites` are the separate Cloudflare/Sites compatibility path; Vinext is beta and is not represented as the same runtime as Next.js.

## Supabase Free — required for cloud saves

1. Create a Free project at https://supabase.com/dashboard. Do not upgrade the organisation or enable paid add-ons.
2. In the SQL Editor, run `supabase/migrations/001_raah.sql` once in the new project.
3. Copy the project URL and **anon/publishable** key from project settings into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
4. Enable email/password authentication. Add the exact local/deployed site URL to the Auth URL configuration. Keep email confirmation enabled. For the hackathon, sign up and confirm your own account before presenting. Default email delivery is rate-limited; do not promise mass public signup readiness.
5. Restart the server. Sign up, confirm email, sign in, save a profile and plan, then reload to verify persistence.
6. Optional catalogue seed: temporarily add a server-only `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, run `npm run seed`, then remove that privileged key. The web application never needs it. The release serves its versioned read-only catalogue from code; normalized tables are populated for a future admin ingestion surface, not falsely claimed as an active live feed.

Security: RLS ties private rows to `auth.uid()`. The server validates bearer tokens via Supabase Auth. Anonymous users cannot access private profile/plan tables. Sign-out clears session state. Authentication tokens use the Supabase SDK's standard browser session persistence; student records are stored in PostgreSQL.

## Gemini free tier

Create a developer API key at https://aistudio.google.com/apikey on a project **without Cloud Billing enabled**. Set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-2.5-flash` on the server. Never prefix the secret with `NEXT_PUBLIC_`. Raah makes no billing/account changes and has no paid fallback. An API key does not reveal whether its Google project has billing enabled; the account owner must verify that setting.

AI use is opt-in in the adviser. Only the message, selected goal and selected skill names are sent; profile names, emails and academic results are omitted. Users should not paste private information in messages. Free-tier data handling differs from paid services: see https://ai.google.dev/gemini-api/terms and the pricing page before a public launch. If the key, network, model or free quota fails, the UI explicitly switches to the deterministic guided adviser.

The initial AI throttle is 15 requests per account per hour per server instance; guest requests share one bucket. This protects a private hackathon preview but is not a distributed public-launch quota. Before a public launch, move quota accounting to an atomic PostgreSQL function or edge rate limiter, and validate age/consent requirements for your intended audience.

## Deployment

For Vercel Hobby (when eligible under its terms): import the GitHub repository, use the default Next.js build, configure the same environment values and deploy. No paid features are required by the source. Check account limits and terms; do not enable paid upgrades.

Sites publishing uses `.openai/hosting.json`, `npm run build:sites` and the Sites connector. Hosted environment values are separate from local `.env.local`; they must be configured as runtime variables. The generated Sites URL is private by default and may not be suitable as the judges' public link until audience access is deliberately changed. PostgreSQL still connects over HTTPS through Supabase.

## Tests and limitations

Run `npm test`, `npm run typecheck`, and `npm run build`. Test a second account to verify row isolation once Supabase is supplied. Do not claim cloud persistence has been verified before this check.

The initial catalogue has nine degree paths, five university/programme exploration entries, six example role briefs, and eleven free learning resources. Only the stated NUST fee/rule subset is source-backed; other admissions data stays unverified. No live job feed, guaranteed eligibility, universal university rankings, unsupported merit cutoffs, application submission or automated LinkedIn scraping is included.

University budget comparisons include known tuition and mandatory semester charges but exclude living costs. Standard NET aggregate supports completed qualifications; incomplete A-level and alternative test routes require separate rules. Resource links include collections rather than pretending all are specific certificate courses.

Public-launch work: distributed quotas, consent/age policy, verified catalogue ingestion and expiry, auth email delivery, account deletion/export, backup/restore testing, monitoring and broader browser/device testing. These are operational requirements, not a database rewrite.
