-- Migration to update votes table schema to match expected structure
-- Changes: voter_id -> voter_user_id, score -> value, is_favorite -> favorite

BEGIN;

-- Check if old columns exist and migrate data
DO $$
BEGIN
    -- If voter_id exists, rename it to voter_user_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' AND column_name = 'voter_id'
    ) THEN
        ALTER TABLE votes RENAME COLUMN voter_id TO voter_user_id;
    END IF;

    -- If score exists, we need to convert it to value (vote_value enum)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' AND column_name = 'score'
    ) THEN
        -- Create vote_value enum if it doesn't exist
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_value') THEN
                CREATE TYPE vote_value AS ENUM ('YES', 'NO', 'UNKNOWN');
            END IF;
        END $$;

        -- Add value column with converted data
        ALTER TABLE votes ADD COLUMN IF NOT EXISTS value vote_value;
        
        -- Convert score to value: 1 = YES, 0 = NO, -1 or NULL = UNKNOWN
        UPDATE votes SET value = CASE
            WHEN score = 1 THEN 'YES'::vote_value
            WHEN score = 0 THEN 'NO'::vote_value
            ELSE 'UNKNOWN'::vote_value
        END WHERE value IS NULL;
        
        -- Make value NOT NULL after conversion
        ALTER TABLE votes ALTER COLUMN value SET NOT NULL;
        
        -- Drop old score column
        ALTER TABLE votes DROP COLUMN IF EXISTS score;
    END IF;

    -- If is_favorite exists, rename it to favorite
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' AND column_name = 'is_favorite'
    ) THEN
        ALTER TABLE votes RENAME COLUMN is_favorite TO favorite;
    END IF;

    -- Add weight_applied if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' AND column_name = 'weight_applied'
    ) THEN
        ALTER TABLE votes ADD COLUMN weight_applied numeric NOT NULL DEFAULT 1.0;
    END IF;

    -- Add voted_at if it doesn't exist (use created_at as fallback)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'votes' AND column_name = 'voted_at'
    ) THEN
        ALTER TABLE votes ADD COLUMN voted_at timestamptz;
        UPDATE votes SET voted_at = created_at WHERE voted_at IS NULL;
        ALTER TABLE votes ALTER COLUMN voted_at SET NOT NULL;
        ALTER TABLE votes ALTER COLUMN voted_at SET DEFAULT now();
    END IF;

    -- Update unique constraint if needed
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'votes_round_id_pnm_id_voter_id_key'
    ) THEN
        ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_round_id_pnm_id_voter_id_key;
    END IF;

    -- Ensure the correct unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'votes_round_id_pnm_id_voter_user_id_key'
    ) THEN
        ALTER TABLE votes ADD CONSTRAINT votes_round_id_pnm_id_voter_user_id_key 
        UNIQUE (round_id, pnm_id, voter_user_id);
    END IF;
END $$;

COMMIT;
