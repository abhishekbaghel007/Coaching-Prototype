# neetprep

Mobile-first NEET UG study platform.

## Current build
- 180 RE-NEET 2026 Code 60 questions
- NTA final answer key integrated
- Q43 marked dropped; Q36 accepts A or D
- Original scanned paper pages included under `public/source-pages/`
- Practice mode with saved questions, mistakes, notes and review flags
- Full timed mock mode with +4/-1 scoring
- Results, subject analytics and local progress persistence
- Supabase authentication preserved
- iOS-inspired premium UI with dark/light mode and accent themes

The question source is the uploaded RE-NEET 2026 paper. The original scan remains visible in the solver because OCR can corrupt equations, symbols and diagrams.

## Cloud persistence
The app keeps a local-first copy for offline safety and syncs signed-in student data to Supabase.

1. Create/open the Supabase project.
2. Run `supabase/001_neetprep_core.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy `VITE_SUPABASE_ANON_KEY`).
4. Run `npm install` and `npm run build`.

Stored student data includes profile settings, saved/mistake/notes state, daily activity, completed attempts, study-plan rows and flashcards. RLS policies restrict rows to the signed-in student.
