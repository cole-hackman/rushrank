-- 0017_bid_outcomes.sql
--
-- What happened after the bid list was finalized.
--
-- The bid list finalizes and the trail goes cold. A chapter's real question in
-- the last week of rush is not "who is on the list" -- that was settled -- but
-- "how many bids do we have left". Today the bid cap counts rows in the `bid`
-- bucket, which is the number of bids *offered*. Two people declining does not
-- give the chapter two bids back, because nothing records that they declined.
--
-- Adding the outcome makes the cap count acceptances, which is what a cap
-- actually means.
--
-- `declined_reason` is free text on purpose. Chapters want to know whether they
-- are losing people to another house, to cost, or to someone deciding against
-- Greek life entirely, and a fixed enum picked in advance would be wrong for
-- most campuses.
--
-- Additive and idempotent, consistent with 0013 onward.

BEGIN;

ALTER TABLE bid_list_entries ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'pending';
ALTER TABLE bid_list_entries ADD COLUMN IF NOT EXISTS outcome_at timestamptz;
ALTER TABLE bid_list_entries ADD COLUMN IF NOT EXISTS outcome_by_user_id uuid;
ALTER TABLE bid_list_entries ADD COLUMN IF NOT EXISTS declined_reason text;

COMMENT ON COLUMN bid_list_entries.outcome IS
  'pending (on the list, nothing handed out yet) -> offered (bid extended) -> '
  'accepted | declined. Only meaningful for bucket = bid; a cut PNM stays '
  'pending forever.';
COMMENT ON COLUMN bid_list_entries.declined_reason IS
  'Free text, not an enum: chapters lose people to other houses, to cost, and '
  'to deciding against Greek life, and the useful breakdown differs by campus.';

DO $mig0017_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bid_list_entries_outcome_by_fkey'
  ) THEN
    ALTER TABLE bid_list_entries
      ADD CONSTRAINT bid_list_entries_outcome_by_fkey
      FOREIGN KEY (outcome_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$mig0017_fk$;

-- Normalize before the CHECK evaluates, the same defence-in-depth pattern 0013
-- used for voting_rounds and 0015 for the pipeline.
CREATE OR REPLACE FUNCTION normalize_bid_outcome()
RETURNS trigger LANGUAGE plpgsql AS $normalize_outcome$
BEGIN
  NEW.outcome := lower(COALESCE(NULLIF(trim(NEW.outcome), ''), 'pending'));
  IF NEW.outcome NOT IN ('pending', 'offered', 'accepted', 'declined') THEN
    NEW.outcome := 'pending';
  END IF;

  -- A reason only means something on a decline; leaving one behind after a
  -- correction would misreport why the chapter lost people.
  IF NEW.outcome <> 'declined' THEN
    NEW.declined_reason := NULL;
  END IF;

  RETURN NEW;
END
$normalize_outcome$;

DROP TRIGGER IF EXISTS bid_list_entries_normalize_outcome ON bid_list_entries;
CREATE TRIGGER bid_list_entries_normalize_outcome
  BEFORE INSERT OR UPDATE ON bid_list_entries
  FOR EACH ROW EXECUTE FUNCTION normalize_bid_outcome();

DO $mig0017_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bid_list_entries_outcome_check'
  ) THEN
    ALTER TABLE bid_list_entries ADD CONSTRAINT bid_list_entries_outcome_check
      CHECK (outcome IN ('pending', 'offered', 'accepted', 'declined'));
  END IF;
END
$mig0017_check$;

-- The cap read: how many acceptances against the bid bucket.
CREATE INDEX IF NOT EXISTS idx_bid_list_entries_outcome
  ON bid_list_entries (bid_list_id, outcome);

DO $mig0017_log$
BEGIN
  IF to_regclass('public.schema_reconciliation_log') IS NOT NULL THEN
    INSERT INTO schema_reconciliation_log (migration, step, action, detail)
    VALUES ('0017', 'bid outcomes', 'applied',
            jsonb_build_object('columns_added',
              ARRAY['outcome', 'outcome_at', 'outcome_by_user_id', 'declined_reason']));
  END IF;
END
$mig0017_log$;

COMMIT;
