alter table if exists public.inspections
  add column if not exists room_aro_veneer jsonb not null default '{}'::jsonb;

alter table if exists public.inspections
  add column if not exists room_aro_veneer_price jsonb not null default '{}'::jsonb;

alter table if exists public.contracted_customers
  add column if not exists room_aro_veneer jsonb not null default '{}'::jsonb;

alter table if exists public.contracted_customers
  add column if not exists room_aro_veneer_price jsonb not null default '{}'::jsonb;

alter table if exists public.non_contracted_customers
  add column if not exists room_aro_veneer jsonb not null default '{}'::jsonb;

alter table if exists public.non_contracted_customers
  add column if not exists room_aro_veneer_price jsonb not null default '{}'::jsonb;
