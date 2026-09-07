-- Run once in a new Supabase project. Subsequent schema changes require new migrations.
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
 updated_at timestamptz not null default now()
);
create table public.plans (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object'),
 updated_at timestamptz not null default now()
);
create index plans_user_updated on public.plans(user_id,updated_at desc);
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
create policy profiles_own on public.profiles for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy plans_own on public.plans for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.profiles, public.plans from anon;
grant select,insert,update,delete on public.profiles,public.plans to authenticated;

create table public.skills(id text primary key,name text unique not null);
create table public.degrees(id text primary key,name text not null,field text not null,data jsonb not null);
create table public.careers(id text primary key,title text not null,degree_id text references public.degrees(id));
create table public.degree_skills(degree_id text references public.degrees(id),skill_id text references public.skills(id),primary key(degree_id,skill_id));
create table public.career_skills(career_id text references public.careers(id),skill_id text references public.skills(id),primary key(career_id,skill_id));
create table public.resources(id text primary key,title text not null,provider text not null,url text not null check(url like 'https://%'),access_label text not null,data jsonb not null);
create table public.resource_skills(resource_id text references public.resources(id),skill_id text references public.skills(id),primary key(resource_id,skill_id));
create table public.universities(id text primary key,name text not null,official_url text not null);
create table public.campuses(id text primary key,university_id text not null references public.universities(id),city text not null,name text not null);
create table public.programmes(id text primary key,campus_id text not null references public.campuses(id),degree_id text references public.degrees(id),title text not null);
create table public.admission_cycles(id uuid primary key default gen_random_uuid(),programme_id text not null references public.programmes(id),academic_year text not null,source_url text not null,checked_at date,verified boolean not null default false,tuition_per_semester numeric check(tuition_per_semester>=0),mandatory_per_semester numeric check(mandatory_per_semester>=0),rules jsonb not null default '{}'::jsonb,historical_merit jsonb,unique(programme_id,academic_year));
create table public.jobs(id text primary key,title text not null,description text not null,source_url text,source_kind text not null check(source_kind in ('example','authorised_feed','employer')),checked_at timestamptz,expires_at timestamptz,city text);
create table public.job_requirements(job_id text references public.jobs(id),skill_id text references public.skills(id),evidence text not null,optional boolean not null default false,primary key(job_id,skill_id));
-- Public catalogue is read-only. Only a trusted migration/admin seed can publish records.
do $$ declare t text; begin
 foreach t in array array['skills','degrees','careers','degree_skills','career_skills','resources','resource_skills','universities','campuses','programmes','admission_cycles','jobs','job_requirements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy catalogue_read on public.%I for select to anon,authenticated using(true)',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 end loop;
end $$;
