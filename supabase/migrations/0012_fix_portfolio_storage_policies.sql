-- Fix portfolio storage bucket and RLS policies
-- This migration ensures the portfolios bucket has proper RLS policies for uploads

-- First, ensure the portfolios bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolios', 'portfolios', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "anon_upload_portfolios" ON storage.objects;
DROP POLICY IF EXISTS "anon_select_portfolios" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_portfolios" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_portfolios" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select_portfolios" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_portfolios" ON storage.objects;

-- Allow authenticated users to upload to portfolios bucket
CREATE POLICY "authenticated_upload_portfolios" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'portfolios');

-- Allow authenticated users to read from portfolios bucket
CREATE POLICY "authenticated_select_portfolios" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'portfolios');

-- Allow authenticated users to delete from portfolios bucket
CREATE POLICY "authenticated_delete_portfolios" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'portfolios');

-- Allow anon users to read from portfolios bucket
CREATE POLICY "anon_select_portfolios" ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'portfolios');

-- Allow anon users to upload (for guests)
CREATE POLICY "anon_upload_portfolios" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'portfolios');
