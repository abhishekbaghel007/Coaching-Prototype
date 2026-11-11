-- Provisional, student-specific scorecards for the scheduled coaching mock series.
-- Scores are generated from NEET marking counts: +4 correct, -1 incorrect, 0 unanswered.
-- Once PDFs and answer keys are uploaded, update the counts and set score_status = 'verified'.

create table if not exists public.mock_series_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mock_key text not null,
  mock_title text not null,
  test_date date not null,

  physics_correct smallint not null check (physics_correct between 0 and 45),
  physics_incorrect smallint not null check (physics_incorrect between 0 and 45),
  physics_unanswered smallint not null check (physics_unanswered between 0 and 45),
  physics_score integer generated always as (4 * physics_correct - physics_incorrect) stored,

  chemistry_correct smallint not null check (chemistry_correct between 0 and 45),
  chemistry_incorrect smallint not null check (chemistry_incorrect between 0 and 45),
  chemistry_unanswered smallint not null check (chemistry_unanswered between 0 and 45),
  chemistry_score integer generated always as (4 * chemistry_correct - chemistry_incorrect) stored,

  biology_correct smallint not null check (biology_correct between 0 and 90),
  biology_incorrect smallint not null check (biology_incorrect between 0 and 90),
  biology_unanswered smallint not null check (biology_unanswered between 0 and 90),
  biology_score integer generated always as (4 * biology_correct - biology_incorrect) stored,

  total_score integer generated always as (
    4 * (physics_correct + chemistry_correct + biology_correct)
    - (physics_incorrect + chemistry_incorrect + biology_incorrect)
  ) stored,

  score_status text not null default 'provisional'
    check (score_status in ('provisional', 'verified')),
  pdf_path text,
  answer_key_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mock_series_scores_physics_count check (
    physics_correct + physics_incorrect + physics_unanswered = 45
  ),
  constraint mock_series_scores_chemistry_count check (
    chemistry_correct + chemistry_incorrect + chemistry_unanswered = 45
  ),
  constraint mock_series_scores_biology_count check (
    biology_correct + biology_incorrect + biology_unanswered = 90
  ),
  constraint mock_series_scores_user_key_unique unique (user_id, mock_key)
);

create index if not exists mock_series_scores_user_date_idx
  on public.mock_series_scores (user_id, test_date desc);

alter table public.mock_series_scores enable row level security;

grant select on table public.mock_series_scores to authenticated;
grant select, insert, update, delete on table public.mock_series_scores to service_role;

create policy mock_series_scores_select_own_or_teacher
  on public.mock_series_scores
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_teacher()));

create policy mock_series_scores_teacher_manage
  on public.mock_series_scores
  for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
