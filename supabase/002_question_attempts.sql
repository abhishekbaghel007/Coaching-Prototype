-- NEETPrep answer history migration.
-- Run this once after the core schema so every answered question can be
-- restored across devices and used for accuracy / weak-subject analytics.

create table if not exists public.question_attempts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  selected_index integer not null check (selected_index between 0 and 3),
  is_correct boolean not null default false,
  subject text not null check (subject in ('Physics', 'Chemistry', 'Biology')),
  mode text not null check (mode in ('practice', 'mock')),
  answered_at timestamptz not null default now()
);

create index if not exists question_attempts_user_answered_idx
  on public.question_attempts(user_id, answered_at desc);

create index if not exists question_attempts_user_subject_idx
  on public.question_attempts(user_id, subject);

alter table public.question_attempts enable row level security;

drop policy if exists "question_attempts_select_own" on public.question_attempts;
drop policy if exists "question_attempts_insert_own" on public.question_attempts;
drop policy if exists "question_attempts_update_own" on public.question_attempts;
drop policy if exists "question_attempts_delete_own" on public.question_attempts;

create policy "question_attempts_select_own"
  on public.question_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "question_attempts_insert_own"
  on public.question_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "question_attempts_update_own"
  on public.question_attempts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "question_attempts_delete_own"
  on public.question_attempts for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.question_attempts to authenticated;
