-- Keep correct options separate from student-readable question text.
-- Answer keys are not readable by students until an instructor releases them.

alter table public.mock_series_questions
  drop column if exists correct_index,
  drop column if exists explanation;

create table if not exists public.mock_series_answer_keys (
  question_id uuid primary key references public.mock_series_questions(id) on delete cascade,
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mock_series_answer_keys enable row level security;

grant select, insert, update, delete on public.mock_series_answer_keys to authenticated;
revoke all on public.mock_series_answer_keys from anon;

drop policy if exists mock_series_answer_keys_released_read on public.mock_series_answer_keys;
create policy mock_series_answer_keys_released_read
  on public.mock_series_answer_keys
  for select to authenticated
  using (
    (released_at is not null and released_at <= now())
    or (select public.is_teacher())
  );

drop policy if exists mock_series_answer_keys_teacher_manage on public.mock_series_answer_keys;
create policy mock_series_answer_keys_teacher_manage
  on public.mock_series_answer_keys
  for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));
