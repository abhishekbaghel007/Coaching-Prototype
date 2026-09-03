# neetprep

Mobile-first NEET UG study platform.

## Current build
- 180 RE-NEET 2026 Code 60 question records
- NTA final answer-key integration foundation
- Q43 marked dropped; Q36 supports multiple accepted answers where mapped
- Original scanned paper pages included under `public/source-pages/`
- Modern Practice solver with readable answer cards
- NTA-style timed CBT shell with question palette and review states
- Mock builder and result/progress foundation
- Saved questions, mistakes, notes and local persistence
- Supabase Auth-compatible cloud persistence layer
- Premium dark/light UI with accent themes

## Supabase

Run `supabase/001_neetprep_core.sql` in the Supabase SQL Editor, then copy `.env.example` to `.env.local` and add:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

See `SUPABASE_SETUP.md` for the setup steps.

The database uses Row Level Security so signed-in students only access their own student data.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```


### Supabase answer-history migration
Run `supabase/002_question_attempts.sql` once in the Supabase SQL Editor. This table stores each answered question for cross-device restoration, accuracy, and weak-subject analytics.

## Teacher Command Center

A protected teacher workspace is available at `/admin`. See `TEACHER_COMMAND_CENTER.md` and run `supabase/003_teacher_command_center.sql` to enable teacher roles, student inspection, DPP creation, teacher attachments and announcements.
