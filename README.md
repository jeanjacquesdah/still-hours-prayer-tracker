# Still Hours - Prayer Tracker

A calming personal prayer-hours tracking web app built with React + Vite, backed by [Supabase](https://supabase.com) (free tier) for real accounts and persistent data.

Sign-in is passwordless: enter your name and email once, and a one-time sign-in link is emailed to you. Everything you log — sessions, journal entries, prayer requests, your prayer chain, reminders, and profile settings — is saved to your account and will still be there the next time you sign in, on any device.

## One-time setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com) (sign up, then "New project"). Pick any name/region; the free tier is enough for this app.
2. In your new project, go to **SQL Editor -> New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**. This creates the tables (`profiles`, `sessions`, `journal_entries`, `prayer_requests`, `prayer_chain`, `reminders`, `custom_categories`, `challenge_members`), turns on Row Level Security so each person can only see their own data, and adds a trigger that creates a profile automatically when someone signs up.
3. Go to **Project Settings -> API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key (not the `service_role` key — that one must never be used in client code)
4. Go to **Authentication -> URL Configuration** and set:
   - **Site URL** to your deployed app's URL (e.g. `https://still-hours-prayer-tracker.vercel.app`)
   - Add both your production URL and `http://localhost:5173` (for local dev) under **Redirect URLs**
   - By default Supabase requires email confirmation for new sign-ups, which works fine with this passwordless flow — no changes needed there.

## Connecting the app to Supabase

Copy `.env.example` to `.env.local` and fill in the two values from step 3 above:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

**For the deployed Vercel app:** add the same two variables in your Vercel project's **Settings -> Environment Variables**, then redeploy. Until these are set, the app shows a short setup notice instead of the sign-in screen.

## Local development

```
npm install
npm run dev
```

## What's persisted per account

Sessions, journal entries, prayer requests, your prayer chain, reminders, custom categories, and profile settings (name, avatar, weekly goal) are all saved to Supabase and scoped to your signed-in account via Row Level Security — nobody else can read or write your rows, including via the API, because every policy checks `auth.uid()` against the row's owner.

The group challenge leaderboard members you add are saved per-account too, but the "group" itself isn't a shared multi-user object yet (each person's list of members is their own) — turning that into a true shared/invite-based group is a reasonable next step if you want it.
