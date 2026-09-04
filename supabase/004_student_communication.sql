-- Student-facing communication layer.
-- Teacher announcements are created by the Teacher Command Center and are
-- readable by authenticated students only when published.

alter table public.teacher_announcements
  add column if not exists is_published boolean not null default true;

grant select on public.teacher_announcements to authenticated;

-- Teachers retain full control. Students can only read published notices.
drop policy if exists teacher_announcements_all on public.teacher_announcements;
create policy teacher_announcements_teacher_all
  on public.teacher_announcements
  for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists student_announcements_read on public.teacher_announcements;
create policy student_announcements_read
  on public.teacher_announcements
  for select
  to authenticated
  using (is_published = true);

-- Enable Postgres Changes for the student announcement inbox. This is safe
-- with the RLS policy above: students only receive rows they can read.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'teacher_announcements'
  ) then
    alter publication supabase_realtime add table public.teacher_announcements;
  end if;
exception
  when undefined_object then
    -- Some projects may not have the publication enabled yet. The app still
    -- works by fetching announcements; Realtime can be enabled later.
    null;
end $$;
