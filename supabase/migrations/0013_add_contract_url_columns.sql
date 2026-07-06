-- Add contract_url column to contracted_customers and non_contracted_customers tables
-- This stores the URL/path to the uploaded signed contract image

ALTER TABLE public.contracted_customers
ADD COLUMN IF NOT EXISTS contract_url text;

ALTER TABLE public.non_contracted_customers
ADD COLUMN IF NOT EXISTS contract_url text;

-- Also add to inspections table for consistency
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS contract_url text;

-- Create a contracts storage bucket for storing contract images
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for contracts bucket
CREATE POLICY "authenticated_upload_contracts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "authenticated_select_contracts" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "authenticated_delete_contracts" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "anon_select_contracts" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'contracts');

CREATE POLICY "anon_upload_contracts" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'contracts');
