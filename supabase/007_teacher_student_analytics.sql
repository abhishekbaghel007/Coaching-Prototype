-- Teacher OS student analytics access.
-- Allows teacher/admin accounts to inspect learning records for the individual student health view.

grant select on public.study_attempts to authenticated;
grant select on public.daily_activity to authenticated;
grant select on public.question_states to authenticated;

alter table public.study_attempts enable row level security;
alter table public.daily_activity enable row level security;
alter table public.question_states enable row level security;

drop policy if exists teacher_study_attempts_select on public.study_attempts;
create policy teacher_study_attempts_select
  on public.study_attempts for select to authenticated
  using ((select public.is_teacher()) or (select auth.uid()) = user_id);

drop policy if exists teacher_daily_activity_select on public.daily_activity;
create policy teacher_daily_activity_select
  on public.daily_activity for select to authenticated
  using ((select public.is_teacher()) or (select auth.uid()) = user_id);

drop policy if exists teacher_question_states_select on public.question_states;
create policy teacher_question_states_select
  on public.question_states for select to authenticated
  using ((select public.is_teacher()) or (select auth.uid()) = user_id);

create index if not exists study_attempts_teacher_finished_idx
  on public.study_attempts(user_id, finished_at desc);
create index if not exists daily_activity_teacher_date_idx
  on public.daily_activity(user_id, activity_date desc);
create index if not exists question_states_teacher_user_idx
  on public.question_states(user_id, updated_at desc);
