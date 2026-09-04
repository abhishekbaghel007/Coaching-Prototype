# neetprep Teacher Command Center

The first teacher release adds a protected `/admin` workspace with:

- batch-level dashboard
- student roster and student performance drawer
- subject accuracy and answer history
- DPP builder using the existing question bank
- optional teacher PDF/image attachment upload
- DPP library
- announcement publisher
- protected teacher-only database access

## One-time Supabase setup

1. Run `supabase/003_teacher_command_center.sql` after migrations 001 and 002.
2. In Supabase Authentication > Users, copy the teacher's user UUID.
3. Run:

```sql
insert into public.teacher_roles (user_id, role)
values ('TEACHER-USER-UUID', 'admin');
```

Use `teacher` instead of `admin` for a normal teacher account.

4. Deploy the Vite app normally.
5. Open `/admin` while signed in with the teacher account.

## Security

The React screen checks the signed-in user's role for UX, but the real protection is Postgres RLS. Teacher access is enforced by `public.is_teacher()` and policies on profiles, answer history, batches, DPPs and teacher content.

## Next release

The schema is intentionally ready for batch assignment, student-facing DPP delivery, test scheduling, intervention messages and richer question analytics. Those should be wired into the student app after this command center is verified with the first teacher account.
