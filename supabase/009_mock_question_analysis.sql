-- Store the question text, option key and each student's selected option.
-- Only text is displayed in the student analysis; diagrams are deliberately omitted.
-- Correct answers remain nullable until each paper's key has been checked.

alter table public.mock_series_scores
  drop constraint if exists mock_series_scores_score_status_check;

update public.mock_series_scores
set score_status = 'estimated'
where score_status = 'provisional';

alter table public.mock_series_scores
  add constraint mock_series_scores_score_status_check
  check (score_status in ('estimated', 'verified'));

create table if not exists public.mock_series_questions (
  id uuid primary key default gen_random_uuid(),
  mock_key text not null,
  question_number smallint not null check (question_number between 1 and 180),
  subject text not null check (subject in ('Physics', 'Chemistry', 'Biology')),
  question_text text not null,
  options jsonb not null check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4
  ),
  correct_index smallint check (correct_index between 0 and 3),
  explanation text,
  pdf_page smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mock_key, question_number)
);

create index if not exists mock_series_questions_paper_idx
  on public.mock_series_questions(mock_key, question_number);

create table if not exists public.mock_series_responses (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.mock_series_questions(id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists mock_series_responses_question_idx
  on public.mock_series_responses(question_id);

alter table public.mock_series_questions enable row level security;
alter table public.mock_series_responses enable row level security;

grant select, insert, update, delete on public.mock_series_questions to authenticated;
grant select, insert, update, delete on public.mock_series_responses to authenticated;

drop policy if exists mock_series_questions_authenticated_read on public.mock_series_questions;
create policy mock_series_questions_authenticated_read
  on public.mock_series_questions for select to authenticated using (true);

drop policy if exists mock_series_questions_teacher_manage on public.mock_series_questions;
create policy mock_series_questions_teacher_manage
  on public.mock_series_questions for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

drop policy if exists mock_series_responses_select_own_or_teacher on public.mock_series_responses;
create policy mock_series_responses_select_own_or_teacher
  on public.mock_series_responses for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_teacher()));

drop policy if exists mock_series_responses_insert_own on public.mock_series_responses;
create policy mock_series_responses_insert_own
  on public.mock_series_responses for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists mock_series_responses_update_own on public.mock_series_responses;
create policy mock_series_responses_update_own
  on public.mock_series_responses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists mock_series_responses_delete_own on public.mock_series_responses;
create policy mock_series_responses_delete_own
  on public.mock_series_responses for delete to authenticated
  using ((select auth.uid()) = user_id);
