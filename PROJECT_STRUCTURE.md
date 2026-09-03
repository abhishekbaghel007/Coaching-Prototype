# Project structure

- `src/App.tsx` — main app, Home, Practice, Mock/CBT, Progress and UI flows
- `src/index.css` — shared design system and responsive styling
- `src/data/questions.ts` — imported RE-NEET question data
- `src/lib/supabase.ts` — browser Supabase client
- `src/lib/cloudSync.ts` — cloud persistence helpers
- `public/source-pages/` — original paper scan pages used as source references
- `supabase/001_neetprep_core.sql` — database schema + Row Level Security policies
- `.env.example` — safe environment-variable template
- `.env.local` — create locally; intentionally ignored by Git
