# El3mmary-furniture

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/eeb87e46-c984-42d4-80a4-4d1ac36bbc43

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the required environment variables in `.env.local` or `.env`:
   - `GEMINI_API_KEY` to your Gemini API key
   - `VITE_SUPABASE_URL` to your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` to your Supabase anon key
3. Create the admin/viewer Supabase auth users:
   - Manual: go to Supabase dashboard → Auth → Users
   - Programmatic: use a Supabase service role key if you want the app to provision them
   - The password used at login comes from the Supabase Auth user record. `ADMIN_PASSWORD` is not used by the current client login flow.
4. Apply the tracked database migration:
   `npx supabase db query --linked --file supabase/migrations/0001_init.sql`
5. Run the app:
   `npm run dev`

## Deploy To Vercel

This repo now uses Supabase only. There is no Firebase code in the current source or in the current production build output.

Before deploying on Vercel:

1. Open your Vercel project for this GitHub repository.
2. In `Settings > Environment Variables`, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` if you use the Gemini features
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` only if you still use it elsewhere; the current client login itself uses the password stored in Supabase Auth
3. Redeploy after saving the variables.

Important:
- Your local `.env` file is not uploaded to Vercel automatically.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the preferred names. The app also accepts `SUPABASE_URL` / `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` as deployment aliases.
- If Vercel still shows an old Firebase-based site, that usually means the wrong Vercel project, wrong repository, or wrong branch is being deployed.
- The build now fails fast when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, so misconfigured Vercel deployments are easier to catch.
