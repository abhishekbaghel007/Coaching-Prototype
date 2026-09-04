# NEETPrep Repository Architecture

## Routes
- `/` Student app. Keep this stable because the Android Capacitor wrapper points here.
- `/website` Public marketing website, intentionally using the same NEETPrep design language.
- `/admin` Private teacher/admin console.

## UI ownership
- `src/design/` shared visual tokens.
- `src/components/` reusable UI and branding primitives.
- `src/student/` student-home feature screens and recommendation logic.
- `src/WebsiteHome.tsx` public website screen.
- `src/admin/` teacher console and data operations.
- `src/App.tsx` student application orchestration and existing learning/test functionality.

## Rule
Do not duplicate buttons, cards, logos, spacing or colour systems in feature files. If a visual pattern is genuinely reusable, promote it to `src/components/`.

## Data
Supabase remains the backend. Existing question bank, auth, cloud sync, teacher command centre, announcements and NTA CBT are preserved.
