-- 0016_contact_coverage.sql
--
-- Who has actually met this guy.
--
-- A chapter votes on sixty PNMs. Any given brother has genuinely spoken to
-- maybe fifteen of them. The rest he votes on off a photo and a vibe -- or
-- abstains, which drags the yes-percentage around for reasons that have nothing
-- to do with the PNM. Nothing in the product distinguished "forty people know
-- him and half said no" from "four people know him and the rest guessed".
--
-- This is the cheapest thing that makes the voting numbers mean something: one
-- table, one tap, one count.
--
-- Design notes
-- ------------
-- A log, not a flag. `event_id` records *where* they met, which turns the same
-- data into "who did we actually talk to at Sports Night" -- the question a
-- rush chair asks the morning after an event.
--
-- The uniqueness rule is per (pnm, brother, event) rather than per (pnm,
-- brother): meeting someone again at a later event is a real second data point,
-- but tapping the button twice at the same event is a double-tap. NULL event_id
-- is folded to a sentinel in the index because NULLs do not compare equal in a
-- unique index before PG15, and this has to behave the same on every version
-- the project might land on.
--
-- Coverage always counts DISTINCT brothers, never rows, so a brother who talks
-- to the same PNM at four events still counts once.

BEGIN;

CREATE TABLE IF NOT EXISTS pnm_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pnm_id     uuid NOT NULL REFERENCES pnms(id)   ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id   uuid          REFERENCES events(id) ON DELETE SET NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pnm_contacts IS
  'One row per brother-met-PNM. Coverage is COUNT(DISTINCT user_id): a brother '
  'who talks to the same PNM at four events still counts once.';
COMMENT ON COLUMN pnm_contacts.event_id IS
  'Where they met, when known. Turns coverage into "who did we actually talk '
  'to at Sports Night". NULL for a contact logged outside an event.';
COMMENT ON COLUMN pnm_contacts.note IS
  'Optional one-liner. Substantive thoughts belong in pnm_notes, which is '
  'visible to the chapter and shows up in exports; this is a memory jog.';

-- The double-tap guard. COALESCE rather than a plain three-column unique index:
-- NULL <> NULL in a unique index before PG15, so two "met him, no event" rows
-- would both be allowed.
CREATE UNIQUE INDEX IF NOT EXISTS pnm_contacts_unique_per_event
  ON pnm_contacts (pnm_id, user_id,
                   COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Coverage count per PNM: the read on every roster and results page.
CREATE INDEX IF NOT EXISTS idx_pnm_contacts_pnm ON pnm_contacts (pnm_id);

-- "Have I met him?" on the voting card, and "who have I met" on a profile.
CREATE INDEX IF NOT EXISTS idx_pnm_contacts_user ON pnm_contacts (user_id, created_at DESC);

-- Post-event review: who did we actually talk to.
CREATE INDEX IF NOT EXISTS idx_pnm_contacts_event ON pnm_contacts (event_id)
  WHERE event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Log it, if 0013's log is present
-- ---------------------------------------------------------------------------

DO $mig0016_log$
BEGIN
  IF to_regclass('public.schema_reconciliation_log') IS NOT NULL THEN
    INSERT INTO schema_reconciliation_log (migration, step, action, detail)
    VALUES ('0016', 'contact coverage', 'applied',
            jsonb_build_object('tables_added', ARRAY['pnm_contacts']));
  END IF;
END
$mig0016_log$;

COMMIT;
