-- Mock-test/exam builder for the Teacher Command Centre.
-- Stores exam configuration separately from the reusable question bank.

create table if not exists public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  exam_type text not null default 'Custom' check (exam_type in ('NEET Full Mock','Part Test','Subject Test','Chapter Test','Custom')),
  status text not null default 'draft' check (status in ('draft','scheduled','published','closed')),
  duration_minutes integer not null default 180 check (duration_minutes between 1 and 1440),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  attempt_limit integer not null default 1 check (attempt_limit between 1 and 20),
  audience_mode text not null default 'all' check (audience_mode in ('all','batch','selected')),
  audience_label text,
  audience_student_ids jsonb not null default '[]'::jsonb,
  instructions text,
  positive_marks numeric(5,2) not null default 4,
  negative_marks numeric(5,2) not null default 1,
  unanswered_marks numeric(5,2) not null default 0,
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  allow_back_navigation boolean not null default true,
  auto_submit boolean not null default true,
  require_fullscreen boolean not null default false,
  allow_resume boolean not null default false,
  result_release text not null default 'after_submit' check (result_release in ('immediate','after_submit','after_close','hidden')),
  show_solutions boolean not null default true,
  show_answer_key boolean not null default false,
  show_rank boolean not null default true,
  show_percentile boolean not null default true,
  pass_percentage numeric(5,2),
  section_config jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mock_test_questions (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  source_type text not null check (source_type in ('builtin','teacher')),
  source_id text not null,
  position integer not null check (position > 0),
  section text not null check (section in ('Physics','Chemistry','Biology')),
  marks numeric(5,2) not null default 4,
  negative_marks numeric(5,2) not null default 1,
  created_at timestamptz not null default now(),
  unique(mock_test_id, position),
  unique(mock_test_id, source_type, source_id)
);

create index if not exists mock_tests_created_by_idx on public.mock_tests(created_by, created_at desc);
create index if not exists mock_tests_schedule_idx on public.mock_tests(scheduled_start, status);
create index if not exists mock_test_questions_test_idx on public.mock_test_questions(mock_test_id, position);

alter table public.mock_tests enable row level security;
alter table public.mock_test_questions enable row level security;
grant select, insert, update, delete on public.mock_tests to authenticated;
grant select, insert, update, delete on public.mock_test_questions to authenticated;

drop policy if exists mock_tests_teacher_all on public.mock_tests;
create policy mock_tests_teacher_all on public.mock_tests for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists mock_test_questions_teacher_all on public.mock_test_questions;
create policy mock_test_questions_teacher_all on public.mock_test_questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create or replace function public.touch_mock_test()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mock_tests_touch on public.mock_tests;
create trigger mock_tests_touch before update on public.mock_tests for each row execute function public.touch_mock_test();
