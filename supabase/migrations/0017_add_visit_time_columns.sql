-- Migration 0017: Add visit_time column to customers and inspections tables

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS visit_time text;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS visit_time text;
ALTER TABLE public.contracted_customers ADD COLUMN IF NOT EXISTS visit_time text;
ALTER TABLE public.non_contracted_customers ADD COLUMN IF NOT EXISTS visit_time text;
