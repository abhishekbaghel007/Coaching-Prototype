-- Teacher-authored question bank.
-- Keeps imported/manual questions structured so they can later be reused by DPPs, tests and student practice.

create table if not exists public.teacher_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index integer check (correct_index between 0 and 3),
  subject text not null check (subject in ('Physics','Chemistry','Biology')),
  chapter text,
  topic text,
  difficulty text check (difficulty in ('Easy','Medium','Hard')),
  explanation text,
  source_name text,
  source_type text not null default 'manual' check (source_type in ('manual','word','paste')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_questions_subject_idx on public.teacher_questions(subject, created_at desc);
create index if not exists teacher_questions_created_by_idx on public.teacher_questions(created_by, created_at desc);

alter table public.teacher_questions enable row level security;
grant select, insert, update, delete on public.teacher_questions to authenticated;

drop policy if exists teacher_questions_all on public.teacher_questions;
create policy teacher_questions_all
on public.teacher_questions
for all to authenticated
using (public.is_teacher())
with check (public.is_teacher());

-- Keep updated_at correct for edits.
create or replace function public.touch_teacher_question()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teacher_questions_touch on public.teacher_questions;
create trigger teacher_questions_touch
before update on public.teacher_questions
for each row execute function public.touch_teacher_question();
