-- Shared, server-side record of every delete performed by the app.
--
-- Previously, "tombstones" preventing a deleted record from reappearing
-- were kept only in each device's local IndexedDB. That meant a deletion
-- performed on one phone/browser was completely invisible to every other
-- device, so a customer deleted on device A could be pushed right back to
-- Supabase by device B (e.g. if B still had a stale, not-yet-confirmed
-- local copy), or would simply keep showing up on any device where the
-- DELETE never actually reached the server (e.g. an auth/RLS mismatch).
--
-- This table gives every device a shared source of truth: whenever a
-- record is deleted, a row is written here, and every device checks this
-- table on every sync pull before trusting a remote row or "healing" a
-- local one back onto the server.

create table if not exists public.deleted_records (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text,
  phone text,
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_records_table_record_idx
  on public.deleted_records (table_name, record_id);

create index if not exists deleted_records_table_phone_idx
  on public.deleted_records (table_name, phone);

alter table public.deleted_records enable row level security;

drop policy if exists "Allow admin and viewer read deleted_records" on public.deleted_records;
create policy "Allow admin and viewer read deleted_records"
on public.deleted_records
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = any (array['admin@gmail.com'::text, 'view@gmail.com'::text])
);

drop policy if exists "Allow admin write deleted_records" on public.deleted_records;
create policy "Allow admin write deleted_records"
on public.deleted_records
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text)
with check ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text);