-- Additive extension storage; existing profiles/plans and their RLS remain authoritative.
begin;
create table if not exists public.user_skill_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 skill_key text not null,
 skill text not null check(length(skill) between 1 and 80),
 primary key(user_id,skill_key),
 check(skill_key=lower(trim(skill)))
);
create table if not exists public.job_analyses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 job_key text not null,
 data jsonb not null check(jsonb_typeof(data)='object'),
 plan_id uuid references public.plans(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique(user_id,job_key)
);
alter table public.user_skill_claims enable row level security;
alter table public.job_analyses enable row level security;
drop policy if exists skill_claims_own on public.user_skill_claims;
create policy skill_claims_own on public.user_skill_claims for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists job_analyses_own on public.job_analyses;
create policy job_analyses_own on public.job_analyses for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.user_skill_claims,public.job_analyses from anon;
grant select,insert,update,delete on public.user_skill_claims,public.job_analyses to authenticated;
commit;
