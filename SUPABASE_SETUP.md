# Supabase setup for neetprep

1. Open the Supabase project used by neetprep.
2. In **SQL Editor**, run `supabase/001_neetprep_core.sql` once.
3. In the project root, copy `.env.example` to `.env.local`.
4. Put your values in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

5. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Do not commit `.env.local`. It is ignored by `.gitignore`.

The browser app must use the Supabase publishable key (or legacy anon key). Never put a Supabase secret/service-role key in this project.
