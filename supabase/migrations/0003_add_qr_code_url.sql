-- Add qr_code_url column to pnms table for storing QR code image URLs
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS qr_code_url text;

