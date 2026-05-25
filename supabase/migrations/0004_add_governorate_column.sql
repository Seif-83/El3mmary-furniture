-- Add governorate column to customers table
ALTER TABLE public.customers ADD COLUMN governorate text;

-- Add governorate column to inspections table
ALTER TABLE public.inspections ADD COLUMN governorate text;

-- Add governorate column to contracted_customers table
ALTER TABLE public.contracted_customers ADD COLUMN governorate text;

-- Add governorate column to non_contracted_customers table
ALTER TABLE public.non_contracted_customers ADD COLUMN governorate text;
