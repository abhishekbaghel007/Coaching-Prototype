-- neetprep core student-data schema
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  target_score integer not null default 30 check (target_score between 1 and 720),
  accent_theme text not null default 'teal',
  appearance text not null default 'dark' check (appearance in ('dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  is_saved boolean not null default false,
  is_mistake boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.study_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('practice', 'mock')),
  question_ids jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_seconds integer not null default 0,
  correct integer not null default 0,
  incorrect integer not null default 0,
  unanswered integer not null default 0,
  dropped integer not null default 0,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists study_attempts_user_finished_idx
  on public.study_attempts(user_id, finished_at desc);

create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  questions_answered integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

-- Ready for the next learning-system phase.
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  plan_date date not null,
  subject text,
  chapter text,
  target_questions integer not null default 0,
  completed_questions integer not null default 0,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  subject text,
  chapter text,
  confidence text not null default 'new' check (confidence in ('new', 'again', 'hard', 'good', 'easy')),
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.question_states enable row level security;
alter table public.study_attempts enable row level security;
alter table public.daily_activity enable row level security;
alter table public.study_plans enable row level security;
alter table public.flashcards enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Question state
create policy "question_states_select_own" on public.question_states for select to authenticated using (auth.uid() = user_id);
create policy "question_states_insert_own" on public.question_states for insert to authenticated with check (auth.uid() = user_id);
create policy "question_states_update_own" on public.question_states for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "question_states_delete_own" on public.question_states for delete to authenticated using (auth.uid() = user_id);

-- Attempts
create policy "study_attempts_select_own" on public.study_attempts for select to authenticated using (auth.uid() = user_id);
create policy "study_attempts_insert_own" on public.study_attempts for insert to authenticated with check (auth.uid() = user_id);
create policy "study_attempts_update_own" on public.study_attempts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_attempts_delete_own" on public.study_attempts for delete to authenticated using (auth.uid() = user_id);

-- Daily activity
create policy "daily_activity_select_own" on public.daily_activity for select to authenticated using (auth.uid() = user_id);
create policy "daily_activity_insert_own" on public.daily_activity for insert to authenticated with check (auth.uid() = user_id);
create policy "daily_activity_update_own" on public.daily_activity for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_activity_delete_own" on public.daily_activity for delete to authenticated using (auth.uid() = user_id);

-- Study plans
create policy "study_plans_select_own" on public.study_plans for select to authenticated using (auth.uid() = user_id);
create policy "study_plans_insert_own" on public.study_plans for insert to authenticated with check (auth.uid() = user_id);
create policy "study_plans_update_own" on public.study_plans for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_plans_delete_own" on public.study_plans for delete to authenticated using (auth.uid() = user_id);

-- Flashcards
create policy "flashcards_select_own" on public.flashcards for select to authenticated using (auth.uid() = user_id);
create policy "flashcards_insert_own" on public.flashcards for insert to authenticated with check (auth.uid() = user_id);
create policy "flashcards_update_own" on public.flashcards for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flashcards_delete_own" on public.flashcards for delete to authenticated using (auth.uid() = user_id);

-- Least-privilege API grants for signed-in students.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.question_states to authenticated;
grant select, insert, update, delete on public.study_attempts to authenticated;
grant select, insert, update, delete on public.daily_activity to authenticated;
grant select, insert, update, delete on public.study_plans to authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;
