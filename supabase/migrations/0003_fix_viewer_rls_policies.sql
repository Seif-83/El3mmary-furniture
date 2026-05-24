alter table if exists public.catalogs enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.inspections enable row level security;
alter table if exists public.contracted_customers enable row level security;
alter table if exists public.non_contracted_customers enable row level security;

drop policy if exists "Allow public read catalogs" on public.catalogs;
drop policy if exists "Allow admin and viewer read catalogs" on public.catalogs;
drop policy if exists "Allow admin write catalogs" on public.catalogs;

drop policy if exists "Allow admin and viewer read customers" on public.customers;
drop policy if exists "Allow admin write customers" on public.customers;
drop policy if exists "allow all for authenticated" on public.customers;

drop policy if exists "Allow admin and viewer read inspections" on public.inspections;
drop policy if exists "Allow admin write inspections" on public.inspections;
drop policy if exists "allow all for authenticated" on public.inspections;

drop policy if exists "Allow admin and viewer read contracted_customers" on public.contracted_customers;
drop policy if exists "Allow admin write contracted_customers" on public.contracted_customers;

drop policy if exists "Allow admin and viewer read non_contracted_customers" on public.non_contracted_customers;
drop policy if exists "Allow admin write non_contracted_customers" on public.non_contracted_customers;

create policy "Allow admin and viewer read catalogs"
on public.catalogs
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = any (array['admin@gmail.com'::text, 'view@gmail.com'::text])
);

create policy "Allow admin write catalogs"
on public.catalogs
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text)
with check ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text);

create policy "Allow admin and viewer read customers"
on public.customers
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = any (array['admin@gmail.com'::text, 'view@gmail.com'::text])
);

create policy "Allow admin write customers"
on public.customers
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text)
with check ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text);

create policy "Allow admin and viewer read inspections"
on public.inspections
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = any (array['admin@gmail.com'::text, 'view@gmail.com'::text])
);

create policy "Allow admin write inspections"
on public.inspections
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text)
with check ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text);

create policy "Allow admin and viewer read contracted_customers"
on public.contracted_customers
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = any (array['admin@gmail.com'::text, 'view@gmail.com'::text])
);

create policy "Allow admin write contracted_customers"
on public.contracted_customers
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text)
with check ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text);

create policy "Allow admin and viewer read non_contracted_customers"
on public.non_contracted_customers
for select
to authenticated
using (
  (auth.jwt() ->> 'email') = any (array['admin@gmail.com'::text, 'view@gmail.com'::text])
);

create policy "Allow admin write non_contracted_customers"
on public.non_contracted_customers
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text)
with check ((auth.jwt() ->> 'email') = 'admin@gmail.com'::text);
