-- Supabase Storage Setup for QR Codes
-- Run this in your Supabase SQL Editor

-- Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-codes',
  'qr-codes',
  true,  -- Public bucket so QR codes are accessible
  1048576,  -- 1MB limit (QR codes are small)
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for qr-codes bucket

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload QR codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'qr-codes');

-- Allow public read access (so QR codes display in emails)
CREATE POLICY "Public can read QR codes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'qr-codes');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update QR codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'qr-codes');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete QR codes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'qr-codes');

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'qr-codes';

