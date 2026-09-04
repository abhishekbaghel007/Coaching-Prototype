# NEETPrep App.tsx — Coaching UI Shell V5

This is the complete replacement for `src/App.tsx` after it was deleted.

## UI direction
- Mobile-first coaching-app shell rather than an AI/productivity website
- Student Home is powered by the existing `src/student/StudentExperience.tsx`
- Removes the duplicate mobile header that previously appeared above the StudentExperience header
- Coaching-style fixed bottom navigation on mobile
- Desktop navigation remains available for larger screens
- Practice, Tests, Revision, Progress, auth, cloud sync, announcements and CBT functionality remain wired through the existing App logic

## Install
Replace only:

`src/App.tsx`

Do not delete or replace:
- `src/student/StudentExperience.tsx`
- `src/student/prepIntelligence.ts`
- `src/main.tsx`
- `src/AdminApp.tsx`
- `src/admin/*`
- `src/lib/*`

The file was syntax/transpile checked with TypeScript 5.8.3 together with the current StudentExperience and prepIntelligence files.
