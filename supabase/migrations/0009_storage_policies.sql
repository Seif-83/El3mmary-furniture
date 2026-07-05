-- Create storage bucket policies for anon users
-- Run this in the Supabase Dashboard SQL Editor

-- 1. Allow anon users to upload PDFs to the portfolios bucket
CREATE POLICY "anon_upload_portfolios" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'portfolios');

-- 2. Allow anon users to read files from the portfolios bucket
CREATE POLICY "anon_select_portfolios" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'portfolios');

-- 3. Allow anon users to delete files from the portfolios bucket
CREATE POLICY "anon_delete_portfolios" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'portfolios');
