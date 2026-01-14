-- Migration to update events table schema to match Python backend expectations
-- Migrates from old schema (starts_at, notes) to new schema (date, description, type, check_in_code, is_active, created_at)

BEGIN;

-- Add new columns if they don't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS date timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('mandatory', 'optional', 'invite_only')) DEFAULT 'optional';
ALTER TABLE events ADD COLUMN IF NOT EXISTS check_in_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL;

-- Migrate data from old columns to new columns if old columns exist
DO $$
BEGIN
    -- If starts_at exists, copy it to date
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'starts_at'
    ) THEN
        UPDATE events SET date = starts_at WHERE date IS NULL;
    END IF;

    -- If notes exists, copy it to description
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'notes'
    ) THEN
        UPDATE events SET description = notes WHERE description IS NULL;
    END IF;

    -- Set default values for any NULL fields
    UPDATE events SET type = 'optional' WHERE type IS NULL;
    UPDATE events SET is_active = true WHERE is_active IS NULL;
    UPDATE events SET created_at = now() WHERE created_at IS NULL;
END $$;

-- Make date NOT NULL if it's not already (after migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'date' AND is_nullable = 'YES'
    ) THEN
        -- Only make NOT NULL if all rows have a date
        IF NOT EXISTS (SELECT 1 FROM events WHERE date IS NULL) THEN
            ALTER TABLE events ALTER COLUMN date SET NOT NULL;
        END IF;
    END IF;
END $$;

-- Drop old columns if they exist (optional - comment out if you want to keep them for now)
-- ALTER TABLE events DROP COLUMN IF EXISTS starts_at;
-- ALTER TABLE events DROP COLUMN IF EXISTS notes;

COMMIT;
