-- Add a separate 45-question Botany and Zoology split to every 180-question mock.
-- Marks are kept consistent with NEET +4/-1/0, with the Biology aggregate retained.
-- These are estimated demo scorecards until actual student responses are available.

alter table public.mock_series_scores
  add column if not exists botany_correct smallint not null default 0 check (botany_correct between 0 and 45),
  add column if not exists botany_incorrect smallint not null default 0 check (botany_incorrect between 0 and 45),
  add column if not exists botany_unanswered smallint not null default 0 check (botany_unanswered between 0 and 45),
  add column if not exists botany_score integer generated always as (4 * botany_correct - botany_incorrect) stored,
  add column if not exists zoology_correct smallint not null default 0 check (zoology_correct between 0 and 45),
  add column if not exists zoology_incorrect smallint not null default 0 check (zoology_incorrect between 0 and 45),
  add column if not exists zoology_unanswered smallint not null default 0 check (zoology_unanswered between 0 and 45),
  add column if not exists zoology_score integer generated always as (4 * zoology_correct - zoology_incorrect) stored;

update public.mock_series_scores as s
set
  physics_correct = v.pc, physics_incorrect = v.pi, physics_unanswered = v.pu,
  chemistry_correct = v.cc, chemistry_incorrect = v.ci, chemistry_unanswered = v.cu,
  botany_correct = v.bc, botany_incorrect = v.bi, botany_unanswered = v.bu,
  zoology_correct = v.zc, zoology_incorrect = v.zi, zoology_unanswered = v.zu,
  biology_correct = v.bc + v.zc,
  biology_incorrect = v.bi + v.zi,
  biology_unanswered = v.bu + v.zu,
  score_status = 'estimated',
  updated_at = now()
from (
  values
    ('neet-level-2026-08-09', 11,6,28, 8,7,30, 21,6,18, 20,8,17),
    ('neet-level-2026-09-06', 10,6,29, 7,4,34, 20,8,17, 19,9,17),
    ('neet-level-2026-09-27', 9,5,31, 7,6,32, 19,8,18, 18,9,18),
    ('neet-level-2026-10-11', 12,6,27, 8,5,32, 23,10,12, 22,10,13),
    ('neet-level-2026-10-25', 15,7,23, 10,5,30, 28,11,6, 27,13,5),
    ('neet-level-2026-11-05', 14,7,24, 9,4,32, 28,15,2, 26,12,7)
) as v(mock_key,pc,pi,pu,cc,ci,cu,bc,bi,bu,zc,zi,zu)
where s.mock_key = v.mock_key;

alter table public.mock_series_scores
  add constraint mock_series_scores_botany_count check (botany_correct + botany_incorrect + botany_unanswered = 45),
  add constraint mock_series_scores_zoology_count check (zoology_correct + zoology_incorrect + zoology_unanswered = 45),
  add constraint mock_series_scores_biology_correct_rollup check (botany_correct + zoology_correct = biology_correct),
  add constraint mock_series_scores_biology_incorrect_rollup check (botany_incorrect + zoology_incorrect = biology_incorrect),
  add constraint mock_series_scores_biology_unanswered_rollup check (botany_unanswered + zoology_unanswered = biology_unanswered);

alter table public.mock_series_questions
  drop constraint if exists mock_series_questions_subject_check;

alter table public.mock_series_questions
  add constraint mock_series_questions_subject_check
  check (subject in ('Physics', 'Chemistry', 'Botany', 'Zoology'));
