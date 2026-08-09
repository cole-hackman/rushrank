-- 0018_gpa_eligibility.sql
--
-- Academic eligibility.
--
-- Most chapters have a GPA minimum, and most campuses require the chapter to
-- certify that every man it bids meets it. There was no GPA field anywhere, so
-- the check was done from a spreadsheet somebody's academic chair kept, and the
-- certification was done from memory.
--
-- The part that matters more than the number
-- ------------------------------------------
-- Exceptions are real. A chapter will bid someone below the minimum -- a
-- transfer with no GPA on file yet, a freshman with one bad semester and a good
-- reason -- and today that conversation happens in a group chat and leaves no
-- record. When nationals asks in March why a man was bid at 2.4 against a 2.5
-- floor, "we discussed it" is not an answer.
--
-- So a waiver is a first-class thing with an author and a reason, written to
-- audit_log by the route. The alternative -- letting people quietly edit the
-- GPA upward -- is what happens when a system has a rule and no way to make an
-- exception to it.
--
-- NULL gpa is "not on file", which is distinct from "below the minimum". A
-- transfer in his first semester genuinely has no GPA, and rendering that as
-- ineligible would be wrong.
--
-- Additive and idempotent, consistent with 0013 onward.

BEGIN;

ALTER TABLE pnms ADD COLUMN IF NOT EXISTS gpa numeric(4,3);
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS gpa_waived boolean NOT NULL DEFAULT false;
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS gpa_waived_by_user_id uuid;
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS gpa_waived_reason text;
ALTER TABLE pnms ADD COLUMN IF NOT EXISTS gpa_waived_at timestamptz;

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS min_gpa numeric(4,3);

COMMENT ON COLUMN pnms.gpa IS
  'NULL means not on file, which is not the same as below the minimum -- a '
  'transfer in his first semester genuinely has no GPA yet.';
COMMENT ON COLUMN pnms.gpa_waived IS
  'Exec granted an exception. Recorded rather than done by quietly editing the '
  'GPA upward, which is what happens when a rule has no exception process.';
COMMENT ON COLUMN chapters.min_gpa IS
  'Chapter or national GPA floor. NULL means the chapter does not enforce one.';

-- numeric(4,3) holds a 4.000 scale; some schools weight to 5.0, so the CHECK is
-- deliberately loose rather than pinned to 4.0.
DO $mig0018_checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pnms_gpa_range_check') THEN
    ALTER TABLE pnms ADD CONSTRAINT pnms_gpa_range_check
      CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chapters_min_gpa_range_check') THEN
    ALTER TABLE chapters ADD CONSTRAINT chapters_min_gpa_range_check
      CHECK (min_gpa IS NULL OR (min_gpa >= 0 AND min_gpa <= 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pnms_gpa_waiver_fkey') THEN
    ALTER TABLE pnms ADD CONSTRAINT pnms_gpa_waiver_fkey
      FOREIGN KEY (gpa_waived_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$mig0018_checks$;

-- A waiver with no author and no reason is the group-chat decision this exists
-- to replace, so the row cannot hold one.
DO $mig0018_waiver_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pnms_gpa_waiver_complete_check') THEN
    ALTER TABLE pnms ADD CONSTRAINT pnms_gpa_waiver_complete_check
      CHECK (
        gpa_waived = false
        OR (gpa_waived_by_user_id IS NOT NULL
            AND gpa_waived_reason IS NOT NULL
            AND btrim(gpa_waived_reason) <> '')
      );
  END IF;
END
$mig0018_waiver_check$;

-- "Who is below the floor" is the read, and it is always chapter-scoped.
CREATE INDEX IF NOT EXISTS idx_pnms_chapter_gpa ON pnms (chapter_id, gpa)
  WHERE gpa IS NOT NULL;

DO $mig0018_log$
BEGIN
  IF to_regclass('public.schema_reconciliation_log') IS NOT NULL THEN
    INSERT INTO schema_reconciliation_log (migration, step, action, detail)
    VALUES ('0018', 'gpa eligibility', 'applied',
            jsonb_build_object(
              'pnms', ARRAY['gpa', 'gpa_waived', 'gpa_waived_by_user_id',
                            'gpa_waived_reason', 'gpa_waived_at'],
              'chapters', ARRAY['min_gpa']));
  END IF;
END
$mig0018_log$;

COMMIT;
