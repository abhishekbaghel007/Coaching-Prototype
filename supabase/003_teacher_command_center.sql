-- neetprep Teacher Command Center
-- Run after 001_neetprep_core.sql and 002_question_attempts.sql.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists email text;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_email on auth.users;
create trigger on_auth_user_profile_email
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_profile_email();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is distinct from u.email;

create table if not exists public.teacher_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.batch_members (
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (batch_id, user_id)
);

create table if not exists public.dpps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  scheduled_for timestamptz not null,
  due_at timestamptz,
  asset_path text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.dpps add column if not exists asset_path text;

create table if not exists public.dpp_questions (
  id uuid primary key default gen_random_uuid(),
  dpp_id uuid not null references public.dpps(id) on delete cascade,
  question_id text not null,
  position integer not null,
  points integer not null default 4,
  unique (dpp_id, position),
  unique (dpp_id, question_id)
);

create table if not exists public.dpp_assignments (
  dpp_id uuid not null references public.dpps(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (dpp_id, batch_id)
);

create table if not exists public.teacher_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.student_interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  type text not null check (type in ('reminder','revision','message','flag')),
  note text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists question_attempts_subject_answered_idx on public.question_attempts(subject, answered_at desc);
create index if not exists batch_members_user_idx on public.batch_members(user_id);
create index if not exists dpps_scheduled_idx on public.dpps(scheduled_for desc);
create index if not exists dpp_questions_dpp_idx on public.dpp_questions(dpp_id, position);

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.teacher_roles where user_id = auth.uid());
$$;

grant execute on function public.is_teacher() to authenticated;

grant select, insert, update, delete on public.teacher_roles to authenticated;
grant select, insert, update, delete on public.batches to authenticated;
grant select, insert, update, delete on public.batch_members to authenticated;
grant select, insert, update, delete on public.dpps to authenticated;
grant select, insert, update, delete on public.dpp_questions to authenticated;
grant select, insert, update, delete on public.dpp_assignments to authenticated;
grant select, insert, update, delete on public.teacher_announcements to authenticated;
grant select, insert, update, delete on public.student_interventions to authenticated;

grant select on public.profiles to authenticated;
grant select on public.question_attempts to authenticated;

alter table public.teacher_roles enable row level security;
alter table public.batches enable row level security;
alter table public.batch_members enable row level security;
alter table public.dpps enable row level security;
alter table public.dpp_questions enable row level security;
alter table public.dpp_assignments enable row level security;
alter table public.teacher_announcements enable row level security;
alter table public.student_interventions enable row level security;

drop policy if exists teacher_roles_self_or_admin on public.teacher_roles;
create policy teacher_roles_self_or_admin on public.teacher_roles for select to authenticated using (user_id = auth.uid() or public.is_teacher());

drop policy if exists teacher_profiles_select on public.profiles;
create policy teacher_profiles_select on public.profiles for select to authenticated using (auth.uid() = id or public.is_teacher());

drop policy if exists teacher_answers_select on public.question_attempts;
create policy teacher_answers_select on public.question_attempts for select to authenticated using (auth.uid() = user_id or public.is_teacher());

drop policy if exists teacher_batches_all on public.batches;
create policy teacher_batches_all on public.batches for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_batch_members_all on public.batch_members;
create policy teacher_batch_members_all on public.batch_members for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_dpps_all on public.dpps;
create policy teacher_dpps_all on public.dpps for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_dpp_questions_all on public.dpp_questions;
create policy teacher_dpp_questions_all on public.dpp_questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_dpp_assignments_all on public.dpp_assignments;
create policy teacher_dpp_assignments_all on public.dpp_assignments for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_announcements_all on public.teacher_announcements;
create policy teacher_announcements_all on public.teacher_announcements for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_interventions_all on public.student_interventions;
create policy teacher_interventions_all on public.student_interventions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- Private teacher uploads. Create the bucket if it does not exist.
insert into storage.buckets (id, name, public)
values ('teacher-assets', 'teacher-assets', false)
on conflict (id) do nothing;

drop policy if exists teacher_assets_select on storage.objects;
create policy teacher_assets_select on storage.objects for select to authenticated using (bucket_id = 'teacher-assets' and public.is_teacher());
drop policy if exists teacher_assets_insert on storage.objects;
create policy teacher_assets_insert on storage.objects for insert to authenticated with check (bucket_id = 'teacher-assets' and public.is_teacher());
drop policy if exists teacher_assets_update on storage.objects;
create policy teacher_assets_update on storage.objects for update to authenticated using (bucket_id = 'teacher-assets' and public.is_teacher()) with check (bucket_id = 'teacher-assets' and public.is_teacher());
drop policy if exists teacher_assets_delete on storage.objects;
create policy teacher_assets_delete on storage.objects for delete to authenticated using (bucket_id = 'teacher-assets' and public.is_teacher());

-- After creating the teacher account, grant it explicitly:
-- insert into public.teacher_roles (user_id, role) values ('YOUR-AUTH-USER-UUID', 'admin');
