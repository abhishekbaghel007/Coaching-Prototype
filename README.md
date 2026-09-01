# Kazan MBBS Next

React + TypeScript + Vite version of Corpus, preserving the existing anatomy question bank and quiz flow while preparing the project for a proper student-account/backend architecture.

## Included
- 351 existing anatomy questions across 7 subjects
- Subject cards and quiz sessions
- Immediate answer feedback
- Reveal answers
- Shuffle-ready architecture
- Results + missed-question review
- Supabase email/password authentication
- Completed quiz attempt saving to `public.quiz_attempts` when a student is signed in

## Existing Supabase columns expected
`quiz_attempts`: `user_id`, `subject`, `total_questions`, `correct_answers`, `score_percentage`.

The frontend only uses the publishable Supabase key. Never put a Supabase service-role key in browser code.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
