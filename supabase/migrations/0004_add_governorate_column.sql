-- Add governorate column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS governorate text;

-- Add governorate column to inspections table
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS governorate text;

-- Add governorate column to contracted_customers table
ALTER TABLE public.contracted_customers ADD COLUMN IF NOT EXISTS governorate text;

-- Add governorate column to non_contracted_customers table
ALTER TABLE public.non_contracted_customers ADD COLUMN IF NOT EXISTS governorate text;
