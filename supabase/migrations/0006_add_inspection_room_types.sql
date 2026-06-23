-- Migration 0006: Add room_types column to inspection tables

alter table if exists public.inspections
  add column if not exists room_types text[] not null default array[]::text[];

alter table if exists public.contracted_customers
  add column if not exists room_types text[] not null default array[]::text[];

alter table if exists public.non_contracted_customers
  add column if not exists room_types text[] not null default array[]::text[];

notify pgrst, 'reload schema';
