-- 0015_pre_rush_pipeline.sql
--
-- The front half of the rush funnel.
--
-- RushRank has always started at "this person is a PNM". But a chapter spends
-- two or three months before that gathering names -- Instagram DMs over the
-- summer, the activities fair, referrals from brothers, walk-ups at tabling --
-- and that whole period lived in an inbox one person had the password to.
-- Prospects were lost every year not because they were cut but because nobody
-- wrote them down.
--
-- The design choice worth explaining: this adds a `stage` column to `pnms`
-- rather than a separate `prospects` table. One identity from the first DM to
-- bid day means notes, tags, photos, events and attendance all work on a
-- prospect immediately, and "convert to PNM" is a status change rather than a
-- data migration that drops history on the floor. The cost is that `pnms` now
-- holds rows that are not yet PNMs, so every roster read has to filter on
-- stage -- which is why the default is 'pnm' and the index leads with it.
--
-- `owner_user_id` is the field that actually changes behaviour. "Someone should
-- message him" is how prospects get lost; "Devin owes him a reply" is how they
-- don't.
--
-- Additive and idempotent, consistent with 0013 and 0014.

BEGIN;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE pnms ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'pnm';
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS contact_status text NOT NULL DEFAULT 'new';
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS instagram_handle text;
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

COMMENT ON COLUMN pnms.stage IS
  'Lifecycle: prospect (pre-rush, being talked to) -> pnm (in formal rush) -> '
  'bid (offered) -> pledged (accepted). Defaults to pnm so every row that '
  'existed before this migration keeps showing up on the roster.';
COMMENT ON COLUMN pnms.source IS
  'Where this person came from. Drives "which channel actually works" and is '
  'set automatically by the public intake link via ?source=.';
COMMENT ON COLUMN pnms.owner_user_id IS
  'The brother running this conversation. NULL means nobody owns the '
  'follow-up, which is the state the pipeline board is designed to surface.';
COMMENT ON COLUMN pnms.contact_status IS
  'Where the conversation stands. Only meaningful while stage = prospect.';

-- FK added separately: ADD COLUMN IF NOT EXISTS cannot carry REFERENCES
-- idempotently, and the constraint may already exist from a partial run.
DO $mig0015_owner_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pnms_owner_user_id_fkey'
  ) THEN
    ALTER TABLE pnms
      ADD CONSTRAINT pnms_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$mig0015_owner_fk$;

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------
-- Normalized by trigger before the CHECK evaluates, the same defence-in-depth
-- pattern 0013 used for voting_rounds: a client sending 'Instagram' or
-- 'INSTAGRAM' should be stored canonically rather than rejected at 3am during
-- rush week.

CREATE OR REPLACE FUNCTION normalize_pnm_pipeline_vocab()
RETURNS trigger LANGUAGE plpgsql AS $normalize_pipeline$
BEGIN
  NEW.stage := lower(COALESCE(NULLIF(trim(NEW.stage), ''), 'pnm'));
  IF NEW.stage NOT IN ('prospect', 'pnm', 'bid', 'pledged') THEN
    NEW.stage := 'pnm';
  END IF;

  NEW.contact_status := lower(COALESCE(NULLIF(trim(NEW.contact_status), ''), 'new'));
  IF NEW.contact_status NOT IN ('new', 'contacted', 'responded', 'invited', 'no_response') THEN
    NEW.contact_status := 'new';
  END IF;

  IF NEW.source IS NOT NULL THEN
    NEW.source := lower(trim(NEW.source));
    IF NEW.source NOT IN ('instagram', 'referral', 'tabling', 'interest_form',
                          'walk_up', 'import', 'manual', 'other') THEN
      NEW.source := 'other';
    END IF;
  END IF;

  -- Stored bare so links, @handles and full URLs all compare equal.
  IF NEW.instagram_handle IS NOT NULL THEN
    NEW.instagram_handle := lower(trim(leading '@' from trim(NEW.instagram_handle)));
    NEW.instagram_handle := NULLIF(NEW.instagram_handle, '');
  END IF;

  RETURN NEW;
END
$normalize_pipeline$;

DROP TRIGGER IF EXISTS pnms_normalize_pipeline_vocab ON pnms;
CREATE TRIGGER pnms_normalize_pipeline_vocab
  BEFORE INSERT OR UPDATE ON pnms
  FOR EACH ROW EXECUTE FUNCTION normalize_pnm_pipeline_vocab();

DO $mig0015_checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pnms_stage_check') THEN
    ALTER TABLE pnms ADD CONSTRAINT pnms_stage_check
      CHECK (stage IN ('prospect', 'pnm', 'bid', 'pledged'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pnms_contact_status_check') THEN
    ALTER TABLE pnms ADD CONSTRAINT pnms_contact_status_check
      CHECK (contact_status IN ('new', 'contacted', 'responded', 'invited', 'no_response'));
  END IF;
END
$mig0015_checks$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Every roster read now filters on stage, so it leads.

CREATE INDEX IF NOT EXISTS idx_pnms_chapter_stage ON pnms (chapter_id, stage, archived);

-- "My prospects" and "nobody owns this one" are the two pipeline reads.
CREATE INDEX IF NOT EXISTS idx_pnms_owner ON pnms (chapter_id, owner_user_id)
  WHERE stage = 'prospect';

-- Dedup against an Instagram handle when the same person DMs and later fills in
-- the form. Partial, because the column is NULL for nearly every row.
CREATE INDEX IF NOT EXISTS idx_pnms_instagram ON pnms (chapter_id, instagram_handle)
  WHERE instagram_handle IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Everything that already exists is a real PNM in formal rush. Recording that
-- explicitly rather than leaning on the column default means a later migration
-- can tell "was never set" from "was set to pnm".

UPDATE pnms SET stage = 'pnm' WHERE stage IS NULL;
UPDATE pnms SET source = 'manual' WHERE source IS NULL AND created_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Log it, if 0013's log is present
-- ---------------------------------------------------------------------------

DO $mig0015_log$
BEGIN
  IF to_regclass('public.schema_reconciliation_log') IS NOT NULL THEN
    INSERT INTO schema_reconciliation_log (migration, step, action, detail)
    VALUES ('0015', 'pre-rush pipeline', 'applied',
            jsonb_build_object('columns_added', ARRAY['stage', 'source',
              'owner_user_id', 'contact_status', 'instagram_handle',
              'last_contacted_at']));
  END IF;
END
$mig0015_log$;

COMMIT;
