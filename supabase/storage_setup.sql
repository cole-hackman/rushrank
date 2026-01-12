-- Supabase Storage Setup for RushRank
-- Run this in your Supabase SQL Editor

-- Create storage bucket for PNM photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pnm-photos',
  'pnm-photos',
  true,  -- Public bucket so photos are accessible
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for pnm-photos bucket

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload PNM photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pnm-photos' AND
  (storage.foldername(name))[1] = 'pnm'
);

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update PNM photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pnm-photos');

-- Allow public read access (so photos display on frontend)
CREATE POLICY "Public can read PNM photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pnm-photos');

-- Allow authenticated users to delete (admin only in app layer)
CREATE POLICY "Authenticated users can delete PNM photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pnm-photos');

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'pnm-photos';

