# NEETPrep Unified Repository

A single Vite + React NEET preparation platform with three coordinated experiences:

- **Student app** at `/`
- **Public website** at `/website`
- **Private teacher/admin console** at `/admin`

All three share the same NEETPrep design tokens and reusable UI primitives while keeping their information architecture separate.

## Existing functionality preserved

Student authentication, guest mode, cloud sync, practice, NTA-style CBT, progress, saved/mistake tracking, announcements and the teacher command centre remain part of the repository.

## Run

```bash
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel/environment variables.

## Important

Deploy the repository root, not `NEET_NewApp`. The Android wrapper currently targets `/`, so that route remains the student app.
