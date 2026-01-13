-- Supabase Storage Setup for Exports (PNM Graphics)
-- Run this in your Supabase SQL Editor

-- Create storage bucket for exports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  true,  -- Public bucket so exports are accessible
  52428800,  -- 50MB limit (for ZIP files with multiple images)
  ARRAY['application/zip', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for exports bucket

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exports');

-- Allow public read access (so exports can be downloaded)
CREATE POLICY "Public can read exports"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'exports');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update exports"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'exports');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'exports');

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'exports';
