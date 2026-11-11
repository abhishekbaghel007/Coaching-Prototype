
-- Permit signed-in students to seed the publicly distributed question text once.
-- Existing question rows remain immutable to students; answer keys remain teacher-managed.

grant insert on public.mock_series_questions to authenticated;

drop policy if exists mock_series_questions_student_seed_insert on public.mock_series_questions;
create policy mock_series_questions_student_seed_insert
  on public.mock_series_questions
  for insert to authenticated
  with check (
    mock_key in (
      'neet-level-2026-08-09',
      'neet-level-2026-09-06',
      'neet-level-2026-09-27',
      'neet-level-2026-10-11',
      'neet-level-2026-10-25',
      'neet-level-2026-11-05'
    )
  );
