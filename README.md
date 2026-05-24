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
4. Apply the tracked database migration:
   `npx supabase db query --linked --file supabase/migrations/0001_init.sql`
5. Run the app:
   `npm run dev`
