# NEETPrep Student Experience V1

This patch upgrades the **mobile student Home** into a more coaching-style personal preparation dashboard.

## Included
- Prep DNA: stage, coaching mode, study hours, focus window
- Today's Mission card
- Marks You Can Recover from the mistake bank
- 7-day Momentum Map
- Three micro-win checklist
- Fast Lanes: Focus Sprint, Mistake Repair, Exam Simulation, Performance
- Personal Signal / weak-subject recommendation
- Coaching Connection / teacher updates
- XP + level progress
- NEETPrep Toolkit sheet for quick navigation
- Local persistence for Prep DNA and micro-wins

## Files
- `src/App.tsx` — updated to render the new student experience on mobile
- `src/student/StudentExperience.tsx` — new student dashboard component

No database migration is required for this V1. Existing Supabase/auth/announcement infrastructure is preserved.

## Install through GitHub web UI
1. Replace root `src/App.tsx` with the included version.
2. Create `src/student/StudentExperience.tsx` and paste the included file.
3. Commit to `main`.
4. Let Vercel deploy.

The existing desktop Home remains unchanged in this patch; the new experience is intentionally mobile-first so it can be refined without disturbing the working desktop/CBT/admin surfaces.
