-- Migration 002: Ingestion pipeline schema additions
-- Run once after 001_coursecompass.sql

-- 1. Verification status enum
create type public.verification_status as enum ('source_backed', 'needs_information', 'stale');

-- 2. Add freshness/traceability columns to universities
alter table public.universities
  add column source_url text,
  add column last_verified_at timestamptz,
  add column verification_status public.verification_status not null default 'needs_information';

-- Backfill: NUST is the only source-backed entry from the initial seed
update public.universities
  set source_url = 'https://nust.edu.pk/admissions/undergraduates/',
      last_verified_at = '2026-09-07 00:00:00+00',
      verification_status = 'source_backed'
  where id = 'nust';

-- For other universities seeded from catalogue, mark needs_information with their known admissions URL
update public.universities
  set source_url = official_url,
      last_verified_at = '2026-09-07 00:00:00+00',
      verification_status = 'needs_information'
  where id != 'nust' and source_url is null;

-- Now enforce not null
alter table public.universities
  alter column source_url set not null;

-- 3. Add freshness columns to campuses
alter table public.campuses
  add column source_url text,
  add column last_verified_at timestamptz,
  add column verification_status public.verification_status not null default 'needs_information';

-- Backfill campuses from parent university
update public.campuses c
  set source_url = u.source_url,
      last_verified_at = u.last_verified_at,
      verification_status = u.verification_status
  from public.universities u
  where c.university_id = u.id;

alter table public.campuses
  alter column source_url set not null;

-- 4. Add freshness columns to programmes
alter table public.programmes
  add column source_url text,
  add column last_verified_at timestamptz,
  add column verification_status public.verification_status not null default 'needs_information';

-- Backfill programmes from parent campus
update public.programmes p
  set source_url = c.source_url,
      last_verified_at = c.last_verified_at,
      verification_status = c.verification_status
  from public.campuses c
  where p.campus_id = c.id;

alter table public.programmes
  alter column source_url set not null;

-- 5. Enhance admission_cycles
alter table public.admission_cycles
  add column last_verified_at timestamptz,
  add column verification_status public.verification_status not null default 'needs_information',
  add column fee_currency text not null default 'PKR',
  add column fee_period text not null default 'semester' check (fee_period in ('semester', 'year', 'programme')),
  add column fee_mandatory_description text;

-- Backfill admission_cycles from checked_at (which exists already)
update public.admission_cycles
  set last_verified_at = checked_at::timestamptz,
      verification_status = case
        when verified = true then 'source_backed'::public.verification_status
        else 'needs_information'::public.verification_status
      end
  where checked_at is not null;

-- 6. Ingestion runs log table (service-role only, no RLS policies opened to public)
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null check (trigger in ('cron', 'manual', 'test')),
  records_attempted int not null default 0,
  records_updated int not null default 0,
  records_failed int not null default 0,
  records_skipped int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  notes text
);
alter table public.ingestion_runs enable row level security;
-- No select/insert policies: only service-role key can access this table

-- 7. Stale-marking DB function (called by ingestion pipeline after each run)
create or replace function public.mark_stale_records(threshold_days int default 90)
returns void
language plpgsql
security definer
as $$
declare
  cutoff timestamptz := now() - (threshold_days || ' days')::interval;
begin
  update public.universities
    set verification_status = 'stale'
    where verification_status = 'source_backed'
      and last_verified_at < cutoff;

  update public.campuses
    set verification_status = 'stale'
    where verification_status = 'source_backed'
      and last_verified_at < cutoff;

  update public.programmes
    set verification_status = 'stale'
    where verification_status = 'source_backed'
      and last_verified_at < cutoff;

  update public.admission_cycles
    set verification_status = 'stale'
    where verification_status = 'source_backed'
      and last_verified_at < cutoff;
end;
$$;

-- 8. Indexes for freshness queries
create index universities_verified_at on public.universities(last_verified_at);
create index admission_cycles_verified_at on public.admission_cycles(last_verified_at);
create index ingestion_runs_started on public.ingestion_runs(started_at desc);
