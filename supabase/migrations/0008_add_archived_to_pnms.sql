-- Add archived column to pnms table
ALTER TABLE pnms 
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Create index for filtering archived PNMs
CREATE INDEX IF NOT EXISTS idx_pnms_archived ON pnms(chapter_id, archived);
