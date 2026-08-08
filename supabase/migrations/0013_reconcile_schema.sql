-- 0013_reconcile_schema.sql
-- ============================================================================
-- Reconciles the two schemas RushRank has been running against.
--
-- Background (see docs/AUDIT-2026-08.md): the project was created from
-- supabase/legacy/schema_pre_migrations.sql, then supabase/migrations/ was
-- added on top. Because 0001 uses CREATE TABLE IF NOT EXISTS, tables that
-- already existed kept their legacy shape while new ones arrived in the modern
-- shape -- and 0005, which was supposed to reconcile `votes`, never ran
-- anywhere because of a dollar-quoting syntax error. The result is a database
-- that matches neither definition, and application code that queries both.
--
-- This migration converges any of those states onto one schema.
--
-- DESIGN RULES
--   1. ADDITIVE ONLY. Nothing is renamed or dropped. Legacy columns and tables
--      survive as deprecated shadows so this file can be applied to production
--      while the *old* backend is still serving traffic. Contraction happens in
--      a later migration, after the new backend is deployed and verified.
--   2. Every statement is guarded by a catalog probe. Constraints are dropped by
--      definition match, never by name, because names differ by origin.
--   3. Idempotent. Re-running is a no-op; the convergence test asserts this.
--   4. Self-describing. Every branch writes to schema_reconciliation_log, so
--      applying this to production *produces* the schema audit that could not
--      be run against it directly. Read that table afterwards.
--   5. No nested dollar-quoting. Every block uses a distinct tag. This is the
--      exact bug that silently disabled 0005 for the life of the project.
--
-- Runs as ONE transaction: a failed assertion at the end rolls everything back.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- §0  Extensions and the reconciliation log
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS schema_reconciliation_log (
  id        bigserial PRIMARY KEY,
  migration text        NOT NULL,
  step      text        NOT NULL,
  action    text        NOT NULL,
  detail    jsonb,
  ran_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schema_reconciliation_log IS
  'Audit trail of what 0013_reconcile_schema.sql found and changed. Query this '
  'after applying to learn what shape the database was actually in.';

CREATE OR REPLACE FUNCTION _recon_log(p_step text, p_action text, p_detail jsonb DEFAULT NULL)
RETURNS void LANGUAGE sql AS $recon_log$
  INSERT INTO schema_reconciliation_log (migration, step, action, detail)
  VALUES ('0013', p_step, p_action, p_detail);
$recon_log$;

-- Convenience predicates, dropped at the end of the file.
CREATE OR REPLACE FUNCTION _recon_has_col(p_table text, p_col text)
RETURNS boolean LANGUAGE sql STABLE AS $recon_has_col$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_col
  );
$recon_has_col$;

CREATE OR REPLACE FUNCTION _recon_has_table(p_table text)
RETURNS boolean LANGUAGE sql STABLE AS $recon_has_table$
  SELECT to_regclass('public.' || quote_ident(p_table)) IS NOT NULL;
$recon_has_table$;

-- ---------------------------------------------------------------------------
-- §1  users -- legacy origin has only (id, email, created_at)
-- ---------------------------------------------------------------------------

DO $recon_users$
BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS name       text;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_exec    boolean NOT NULL DEFAULT false;

  -- email: legacy is text, modern is citext. Normalise so lookups are
  -- case-insensitive everywhere (the API lowercases inconsistently).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users'
      AND column_name='email' AND udt_name = 'text'
  ) THEN
    ALTER TABLE users ALTER COLUMN email TYPE citext USING email::citext;
    PERFORM _recon_log('users.email', 'converted text -> citext');
  ELSE
    PERFORM _recon_log('users.email', 'skipped: already citext');
  END IF;
END
$recon_users$;

-- ---------------------------------------------------------------------------
-- §2  auth.users -> public.users sync
--
-- Nothing has ever synced these. The only INSERT INTO users lives inside the
-- admin invite flow, so a user who signs up via magic link has an auth.users
-- row and no public.users row -- which means a foreign-key violation the moment
-- chapter provisioning inserts their membership, and a 404 from GET /me.
--
-- Guarded on the auth schema existing so this file still applies to the bare
-- Postgres used by CI.
-- ---------------------------------------------------------------------------

DO $recon_auth$
DECLARE
  v_inserted  bigint := 0;
  v_repointed bigint := 0;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    PERFORM _recon_log('auth.users sync', 'skipped: no auth schema (CI/bare postgres)');
    RETURN;
  END IF;

  -- Repoint any public.users row whose email matches an auth.users row under a
  -- different id. These arise when someone is invited (which mints a local id)
  -- and later signs up for real. Without this they get a permanent 404 on /me.
  CREATE TEMP TABLE _recon_orphans ON COMMIT DROP AS
  SELECT pu.id AS old_id, au.id AS new_id
  FROM public.users pu
  JOIN auth.users au ON lower(au.email) = lower(pu.email::text)
  WHERE pu.id <> au.id;

  SELECT count(*) INTO v_repointed FROM _recon_orphans;

  IF v_repointed > 0 THEN
    -- Make room for the repointed rows, then move every FK child across.
    INSERT INTO public.users (id, email)
    SELECT o.new_id, pu.email FROM _recon_orphans o
    JOIN public.users pu ON pu.id = o.old_id
    ON CONFLICT (id) DO NOTHING;

    UPDATE memberships m SET user_id = o.new_id FROM _recon_orphans o WHERE m.user_id = o.old_id;

    IF _recon_has_col('votes', 'voter_user_id') THEN
      UPDATE votes v SET voter_user_id = o.new_id FROM _recon_orphans o WHERE v.voter_user_id = o.old_id;
    END IF;
    IF _recon_has_col('votes', 'voter_id') THEN
      UPDATE votes v SET voter_id = o.new_id FROM _recon_orphans o WHERE v.voter_id = o.old_id;
    END IF;
    IF _recon_has_col('pnms', 'created_by') THEN
      UPDATE pnms p SET created_by = o.new_id FROM _recon_orphans o WHERE p.created_by = o.old_id;
    END IF;
    IF _recon_has_col('pnm_notes', 'author_user_id') THEN
      UPDATE pnm_notes n SET author_user_id = o.new_id FROM _recon_orphans o WHERE n.author_user_id = o.old_id;
    END IF;
    IF _recon_has_col('event_attendance', 'checked_in_by_user_id') THEN
      UPDATE event_attendance a SET checked_in_by_user_id = o.new_id FROM _recon_orphans o WHERE a.checked_in_by_user_id = o.old_id;
    END IF;
    IF _recon_has_col('bid_lists', 'locked_by') THEN
      UPDATE bid_lists b SET locked_by = o.new_id FROM _recon_orphans o WHERE b.locked_by = o.old_id;
    END IF;

    -- Deduplicate memberships the repoint may have collided into.
    DELETE FROM memberships m USING memberships k
    WHERE m.user_id = k.user_id AND m.chapter_id = k.chapter_id AND m.id > k.id;

    DELETE FROM public.users pu USING _recon_orphans o WHERE pu.id = o.old_id;
  END IF;

  -- Backfill anyone in auth.users with no local row at all.
  WITH ins AS (
    INSERT INTO public.users (id, email)
    SELECT au.id, au.email FROM auth.users au
    WHERE au.email IS NOT NULL
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  PERFORM _recon_log('auth.users sync', 'reconciled',
    jsonb_build_object('inserted', v_inserted, 'repointed', v_repointed));
END
$recon_auth$;

-- Backstop trigger so future signups can never drift again. The backend also
-- upserts on every authenticated request; this covers users who verify their
-- email but do not immediately hit the API.
DO $recon_auth_trigger$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    PERFORM _recon_log('auth.users trigger', 'skipped: no auth schema');
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $handle_new_user$
  BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
  END
  $handle_new_user$;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

  PERFORM _recon_log('auth.users trigger', 'installed');
END
$recon_auth_trigger$;

-- ---------------------------------------------------------------------------
-- §3  memberships.role -- the single source of truth for authorization
--
-- Lowercase text over {admin, exec, member, observer}. `exec` is added because
-- routes.py::_require_admin_or_exec already tests for it while the existing
-- CHECK constraint makes it unreachable, so every bid-list route is silently
-- admin-only today.
-- ---------------------------------------------------------------------------

DO $recon_roles$
DECLARE
  r            record;
  v_normalized bigint := 0;
  v_unexpected jsonb;
BEGIN
  -- Drop the existing CHECK by definition, not by name: the constraint is
  -- called different things depending on which schema created the table.
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'memberships'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE memberships DROP CONSTRAINT %I', r.conname);
    PERFORM _recon_log('memberships.role', 'dropped constraint', jsonb_build_object('name', r.conname));
  END LOOP;

  -- Record anything we are about to coerce, so the change is reviewable.
  SELECT jsonb_agg(jsonb_build_object('role', role, 'count', n)) INTO v_unexpected
  FROM (
    SELECT role, count(*) AS n FROM memberships
    WHERE lower(role) NOT IN ('admin','exec','member','observer','brother')
    GROUP BY role
  ) s;

  UPDATE memberships SET role = CASE lower(role)
    WHEN 'admin'    THEN 'admin'
    WHEN 'exec'     THEN 'exec'
    WHEN 'brother'  THEN 'member'
    WHEN 'member'   THEN 'member'
    WHEN 'observer' THEN 'observer'
    ELSE 'member'
  END
  WHERE role IS DISTINCT FROM CASE lower(role)
    WHEN 'admin' THEN 'admin' WHEN 'exec' THEN 'exec'
    WHEN 'brother' THEN 'member' WHEN 'member' THEN 'member'
    WHEN 'observer' THEN 'observer' ELSE 'member' END;

  GET DIAGNOSTICS v_normalized = ROW_COUNT;

  ALTER TABLE memberships
    ADD CONSTRAINT memberships_role_check
    CHECK (role IN ('admin','exec','member','observer'));

  PERFORM _recon_log('memberships.role', 'normalized',
    jsonb_build_object('rows_changed', v_normalized, 'coerced_to_member', v_unexpected));
END
$recon_roles$;

-- users.is_exec is only read by v_round_rankings. Derive it from memberships so
-- it stops being a second, divergent source of truth.
DO $recon_is_exec$
BEGIN
  UPDATE users u SET is_exec = EXISTS (
    SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.role IN ('admin','exec')
  )
  WHERE u.is_exec IS DISTINCT FROM EXISTS (
    SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.role IN ('admin','exec')
  );
  PERFORM _recon_log('users.is_exec', 'derived from memberships');
END
$recon_is_exec$;

-- ---------------------------------------------------------------------------
-- §4  votes -- the work 0005 was supposed to do, done correctly
--
-- Legacy shape: voter_id / score int (1..10) / is_favorite / created_at
-- Target shape: voter_user_id / value enum / favorite / weight_applied / voted_at
--
-- The legacy columns are KEPT and their NOT NULL constraints relaxed, so the
-- currently-deployed backend keeps working after this migration is applied.
-- ---------------------------------------------------------------------------

DO $recon_votes$
DECLARE
  v_backfilled bigint := 0;
  v_dist       jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_value') THEN
    CREATE TYPE vote_value AS ENUM ('YES', 'NO', 'UNKNOWN');
  END IF;

  ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_user_id  uuid;
  ALTER TABLE votes ADD COLUMN IF NOT EXISTS value          vote_value;
  ALTER TABLE votes ADD COLUMN IF NOT EXISTS favorite       boolean NOT NULL DEFAULT false;
  ALTER TABLE votes ADD COLUMN IF NOT EXISTS weight_applied numeric NOT NULL DEFAULT 1.0;
  ALTER TABLE votes ADD COLUMN IF NOT EXISTS voted_at       timestamptz NOT NULL DEFAULT now();

  IF _recon_has_col('votes', 'voter_id') THEN
    UPDATE votes SET voter_user_id = voter_id WHERE voter_user_id IS NULL;
    ALTER TABLE votes ALTER COLUMN voter_id DROP NOT NULL;
  END IF;

  IF _recon_has_col('votes', 'is_favorite') THEN
    UPDATE votes SET favorite = COALESCE(is_favorite, false) WHERE favorite IS DISTINCT FROM COALESCE(is_favorite, false);
    ALTER TABLE votes ALTER COLUMN is_favorite DROP NOT NULL;
  END IF;

  IF _recon_has_col('votes', 'created_at') THEN
    UPDATE votes SET voted_at = created_at WHERE created_at IS NOT NULL AND voted_at IS DISTINCT FROM created_at;
  END IF;

  IF _recon_has_col('votes', 'score') THEN
    -- The mapping the API itself uses (python_server/routes.py). NOT the one in
    -- the original 0005, which read score=1 as YES -- score is CHECK(1..10),
    -- so 1 is the strongest *no*. That migration never ran; had it run it would
    -- have inverted every downvote.
    UPDATE votes SET value = CASE
      WHEN score >= 7 THEN 'YES'::vote_value
      WHEN score <= 4 THEN 'NO'::vote_value
      ELSE 'UNKNOWN'::vote_value
    END
    WHERE value IS NULL AND score IS NOT NULL;
    GET DIAGNOSTICS v_backfilled = ROW_COUNT;

    -- The new backend writes only `value`; without this, every insert fails.
    ALTER TABLE votes ALTER COLUMN score DROP NOT NULL;

    SELECT jsonb_object_agg(COALESCE(value::text, 'null'), n) INTO v_dist
    FROM (SELECT value, count(*) n FROM votes GROUP BY value) s;

    PERFORM _recon_log('votes.score -> value', 'backfilled',
      jsonb_build_object('rows', v_backfilled, 'distribution', v_dist));
  ELSE
    PERFORM _recon_log('votes.score -> value', 'skipped: no legacy score column');
  END IF;

  -- Drop the legacy 1..10 range CHECK; nothing writes score any more.
  DECLARE c record;
  BEGIN
    FOR c IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'votes'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%score%'
    LOOP
      EXECUTE format('ALTER TABLE votes DROP CONSTRAINT %I', c.conname);
      PERFORM _recon_log('votes.score', 'dropped range constraint', jsonb_build_object('name', c.conname));
    END LOOP;
  END;

  -- One vote per (round, pnm, voter) on the new column.
  DECLARE u record;
  BEGIN
    FOR u IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'votes'::regclass AND contype = 'u'
        AND pg_get_constraintdef(oid) ILIKE '%voter_id%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%voter_user_id%'
    LOOP
      EXECUTE format('ALTER TABLE votes DROP CONSTRAINT %I', u.conname);
      PERFORM _recon_log('votes unique', 'dropped legacy constraint', jsonb_build_object('name', u.conname));
    END LOOP;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'votes'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%voter_user_id%'
  ) THEN
    -- Only safe once duplicates are gone; report rather than fail if any remain.
    IF EXISTS (
      SELECT 1 FROM votes WHERE voter_user_id IS NOT NULL
      GROUP BY round_id, pnm_id, voter_user_id HAVING count(*) > 1
    ) THEN
      PERFORM _recon_log('votes unique', 'SKIPPED: duplicate (round,pnm,voter) rows present -- resolve manually');
    ELSE
      ALTER TABLE votes ADD CONSTRAINT votes_round_pnm_voter_user_key UNIQUE (round_id, pnm_id, voter_user_id);
      PERFORM _recon_log('votes unique', 'added on voter_user_id');
    END IF;
  END IF;
END
$recon_votes$;

CREATE INDEX IF NOT EXISTS idx_votes_voter_user_id ON votes (voter_user_id);
CREATE INDEX IF NOT EXISTS idx_votes_round_voter   ON votes (round_id, voter_user_id);

-- ---------------------------------------------------------------------------
-- §5  voting_rounds -- broken against BOTH schemas before this point
--
-- The legacy definition has room_code / selected_pnm_ids / started_at /
-- ended_at but constrains `type` to ('rush','dinner','interview','final').
-- 0001's definition has settings / name / created_by and enum types, but none
-- of the four columns the application reads. The backend writes type='GENERAL'
-- and reads all four, so POST /rounds/open, POST /sessions and POST
-- /sessions/join could not succeed against either. This is why live voting was
-- feature-flagged off rather than debugged.
-- ---------------------------------------------------------------------------

DO $recon_rounds$
DECLARE
  c record;
BEGIN
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS name             text;
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS settings         jsonb NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS created_by       uuid REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS room_code        text;
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS selected_pnm_ids text[] NOT NULL DEFAULT '{}';
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS started_at       timestamptz;
  ALTER TABLE voting_rounds ADD COLUMN IF NOT EXISTS ended_at         timestamptz;

  -- Convert enum columns to text. Text + CHECK is widenable without a type
  -- rewrite, and it lets the application stop writing `status = 'ACTIVE' OR
  -- status = 'active'` disjunctions everywhere.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='voting_rounds'
      AND column_name='type' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE voting_rounds ALTER COLUMN type TYPE text USING type::text;
    PERFORM _recon_log('voting_rounds.type', 'converted enum -> text');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='voting_rounds'
      AND column_name='status' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE voting_rounds ALTER COLUMN status TYPE text USING status::text;
    PERFORM _recon_log('voting_rounds.status', 'converted enum -> text');
  END IF;

  -- Drop legacy CHECKs on type/status by definition match.
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'voting_rounds'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%type%' OR pg_get_constraintdef(oid) ILIKE '%status%')
  LOOP
    EXECUTE format('ALTER TABLE voting_rounds DROP CONSTRAINT %I', c.conname);
    PERFORM _recon_log('voting_rounds', 'dropped constraint', jsonb_build_object('name', c.conname));
  END LOOP;

  -- Uppercase is canonical.
  UPDATE voting_rounds SET type = CASE lower(COALESCE(type,''))
    WHEN 'rush' THEN 'GENERAL' WHEN 'general' THEN 'GENERAL'
    WHEN 'dinner' THEN 'INVITE' WHEN 'invite' THEN 'INVITE'
    WHEN 'interview' THEN 'GENERAL'
    WHEN 'final' THEN 'BID' WHEN 'bid' THEN 'BID'
    ELSE 'GENERAL' END;

  UPDATE voting_rounds SET status = CASE lower(COALESCE(status,''))
    WHEN 'pending' THEN 'DRAFT' WHEN 'draft' THEN 'DRAFT'
    WHEN 'active' THEN 'ACTIVE'
    WHEN 'locked' THEN 'LOCKED'
    WHEN 'completed' THEN 'ENDED' WHEN 'ended' THEN 'ENDED'
    ELSE 'DRAFT' END;

  ALTER TABLE voting_rounds ALTER COLUMN type   SET DEFAULT 'GENERAL';
  ALTER TABLE voting_rounds ALTER COLUMN status SET DEFAULT 'DRAFT';
  ALTER TABLE voting_rounds ALTER COLUMN type   SET NOT NULL;
  ALTER TABLE voting_rounds ALTER COLUMN status SET NOT NULL;

  ALTER TABLE voting_rounds ADD CONSTRAINT voting_rounds_type_check
    CHECK (type IN ('GENERAL','INVITE','BID'));
  ALTER TABLE voting_rounds ADD CONSTRAINT voting_rounds_status_check
    CHECK (status IN ('DRAFT','ACTIVE','LOCKED','ENDED'));

  -- room_code is generated by the API but must be unique; backfill first.
  UPDATE voting_rounds SET room_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 6))
  WHERE room_code IS NULL OR room_code = '';

  IF EXISTS (SELECT 1 FROM voting_rounds GROUP BY room_code HAVING count(*) > 1) THEN
    PERFORM _recon_log('voting_rounds.room_code', 'SKIPPED unique index: duplicates present');
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS voting_rounds_room_code_key ON voting_rounds (room_code);
  END IF;

  PERFORM _recon_log('voting_rounds', 'reconciled');
END
$recon_rounds$;

-- Keep round_pnms populated from selected_pnm_ids. get_round_results filters on
-- round_pnms while every write path uses the array, which is why results came
-- back empty for every round.
INSERT INTO round_pnms (round_id, pnm_id, order_index)
SELECT vr.id, x.pnm_id::uuid, (x.ord - 1)::int
FROM voting_rounds vr,
     LATERAL unnest(vr.selected_pnm_ids) WITH ORDINALITY AS x(pnm_id, ord)
WHERE x.pnm_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (SELECT 1 FROM pnms p WHERE p.id = x.pnm_id::uuid)
ON CONFLICT DO NOTHING;

SELECT _recon_log('round_pnms', 'backfilled from selected_pnm_ids',
  jsonb_build_object('rows', (SELECT count(*) FROM round_pnms)));

-- ---------------------------------------------------------------------------
-- §6  pnms -- each origin is missing columns the API selects
--
-- Legacy origin has no email/phone at all, so GET /pnms (which selects
-- p.email, p.phone) fails outright. A migrations-only database is missing the
-- three fun-fact columns that models.PNM declares as required.
-- ---------------------------------------------------------------------------

DO $recon_pnms$
DECLARE
  v_tags bigint := 0;
BEGIN
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS email             citext;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS phone             text;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS fun_fact          text;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS walkout_song      text;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS weirdest_talent   text;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS chick_fil_a_order text;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS qr_code_url       text;
  ALTER TABLE pnms ADD COLUMN IF NOT EXISTS archived          boolean NOT NULL DEFAULT false;

  -- CSV import and the public intake form cannot always supply a major.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pnms'
      AND column_name='major' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE pnms ALTER COLUMN major DROP NOT NULL;
    PERFORM _recon_log('pnms.major', 'relaxed NOT NULL');
  END IF;

  -- Legacy stored tags as a text[] on the row; the modern schema normalises
  -- them into tags + pnm_tags, which is what every query now reads.
  IF _recon_has_col('pnms', 'tags') THEN
    INSERT INTO tags (chapter_id, label)
    SELECT DISTINCT p.chapter_id, trim(t.label)
    FROM pnms p, LATERAL unnest(p.tags) AS t(label)
    WHERE trim(COALESCE(t.label,'')) <> ''
    ON CONFLICT (chapter_id, label) DO NOTHING;

    WITH ins AS (
      INSERT INTO pnm_tags (pnm_id, tag_id)
      SELECT p.id, tg.id
      FROM pnms p
      CROSS JOIN LATERAL unnest(p.tags) AS t(label)
      JOIN tags tg ON tg.chapter_id = p.chapter_id AND tg.label = trim(t.label)
      WHERE trim(COALESCE(t.label,'')) <> ''
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO v_tags FROM ins;

    PERFORM _recon_log('pnms.tags -> pnm_tags', 'migrated', jsonb_build_object('links', v_tags));
  ELSE
    PERFORM _recon_log('pnms.tags -> pnm_tags', 'skipped: no legacy tags column');
  END IF;
END
$recon_pnms$;

-- ---------------------------------------------------------------------------
-- §7  attendance -> event_attendance
-- ---------------------------------------------------------------------------

DO $recon_attendance$
DECLARE
  v_copied bigint := 0;
BEGIN
  ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS notes text;

  IF NOT _recon_has_table('attendance') THEN
    PERFORM _recon_log('attendance -> event_attendance', 'skipped: no legacy table');
    RETURN;
  END IF;

  WITH ins AS (
    INSERT INTO event_attendance (event_id, pnm_id, checked_in_by_user_id, checked_in_at, method, notes)
    SELECT a.event_id, a.pnm_id,
           (SELECT u.id FROM users u WHERE u.id = a.checked_in_by),
           a.checked_in_at,
           CASE WHEN COALESCE(a.notes,'') ILIKE '%qr%' THEN 'QR'::attendance_method ELSE 'SEARCH'::attendance_method END,
           a.notes
    FROM attendance a
    WHERE EXISTS (SELECT 1 FROM events e WHERE e.id = a.event_id)
      AND EXISTS (SELECT 1 FROM pnms  p WHERE p.id = a.pnm_id)
    ON CONFLICT (event_id, pnm_id) DO UPDATE
      SET notes = COALESCE(event_attendance.notes, EXCLUDED.notes)
    RETURNING 1
  )
  SELECT count(*) INTO v_copied FROM ins;

  PERFORM _recon_log('attendance -> event_attendance', 'copied', jsonb_build_object('rows', v_copied));
END
$recon_attendance$;

-- ---------------------------------------------------------------------------
-- §8  notes -> pnm_notes
-- ---------------------------------------------------------------------------

DO $recon_notes$
DECLARE
  v_copied bigint := 0;
BEGIN
  -- legacy_id makes an otherwise unkeyed row copy idempotent.
  ALTER TABLE pnm_notes ADD COLUMN IF NOT EXISTS legacy_id uuid;
  CREATE UNIQUE INDEX IF NOT EXISTS pnm_notes_legacy_id_key ON pnm_notes (legacy_id) WHERE legacy_id IS NOT NULL;

  IF NOT _recon_has_table('notes') THEN
    PERFORM _recon_log('notes -> pnm_notes', 'skipped: no legacy table');
    RETURN;
  END IF;

  WITH ins AS (
    INSERT INTO pnm_notes (legacy_id, pnm_id, author_user_id, body, anonymous, created_at)
    SELECT n.id, n.pnm_id,
           (SELECT u.id FROM users u WHERE u.id = n.author_id),
           n.body, false, n.created_at
    FROM notes n
    WHERE EXISTS (SELECT 1 FROM pnms p WHERE p.id = n.pnm_id)
    -- Predicate repeated so inference matches the partial unique index.
    ON CONFLICT (legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_copied FROM ins;

  PERFORM _recon_log('notes -> pnm_notes', 'copied',
    jsonb_build_object('rows', v_copied,
                       'note', 'legacy notes.tags[] is not carried across -- pnm_notes has no tags column'));
END
$recon_notes$;

-- ---------------------------------------------------------------------------
-- §9  chapters / events -- small gaps
-- ---------------------------------------------------------------------------

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS domain_allowlist text[] NOT NULL DEFAULT '{}';
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS school           text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS fraternity       text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS theme            jsonb NOT NULL
  DEFAULT '{"enabled": false, "accent_hex": null, "source": "auto"}'::jsonb;

ALTER TABLE events ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location      text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS check_in_code text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active     boolean NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS type          text NOT NULL DEFAULT 'optional';
ALTER TABLE events ADD COLUMN IF NOT EXISTS date          timestamptz;

-- 0001 named the column starts_at; everything in the app reads `date`.
DO $recon_events$
BEGIN
  IF _recon_has_col('events', 'starts_at') THEN
    UPDATE events SET date = starts_at WHERE date IS NULL AND starts_at IS NOT NULL;
    ALTER TABLE events ALTER COLUMN starts_at DROP NOT NULL;
    PERFORM _recon_log('events.starts_at -> date', 'backfilled');
  END IF;
END
$recon_events$;

-- ---------------------------------------------------------------------------
-- §10  audit_log (used by round cutoffs, role changes, bid-list finalize)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id     uuid REFERENCES chapters(id) ON DELETE CASCADE,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  action         text NOT NULL,
  entity_type    text,
  entity_id      uuid,
  before         jsonb,
  after          jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_chapter_created ON audit_log (chapter_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- §11  Views deferred out of 0002, now that votes is reconciled
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_round_rankings AS
WITH scoring AS (
  SELECT
    v.round_id,
    v.pnm_id,
    COUNT(*)                                        AS total_votes,
    COUNT(*) FILTER (WHERE v.value = 'YES')         AS yes_count,
    COUNT(*) FILTER (WHERE v.value = 'NO')          AS no_count,
    COUNT(*) FILTER (WHERE v.value = 'UNKNOWN')     AS unknown_count,
    COUNT(*) FILTER (WHERE v.favorite)              AS favorite_count,
    SUM(
      CASE v.value WHEN 'YES' THEN 1.0 WHEN 'UNKNOWN' THEN 0.5 ELSE 0.0 END
      * (CASE WHEN u.is_exec THEN COALESCE((vr.settings->>'execWeight')::numeric, 1.0) ELSE 1.0 END)
    ) AS weighted_sum,
    SUM(CASE WHEN u.is_exec THEN COALESCE((vr.settings->>'execWeight')::numeric, 1.0) ELSE 1.0 END) AS weight_total,
    -- Controversy: population stddev of the 0/0.5/1 mapping, scaled to 0-10 so
    -- the PRD's ">= 2.0 is controversial" threshold is meaningful.
    COALESCE(STDDEV_POP(CASE v.value WHEN 'YES' THEN 1.0 WHEN 'UNKNOWN' THEN 0.5 ELSE 0.0 END), 0) * 20 AS controversy_score
  FROM votes v
  JOIN users u          ON u.id  = v.voter_user_id
  JOIN voting_rounds vr ON vr.id = v.round_id
  GROUP BY v.round_id, v.pnm_id
)
SELECT
  s.round_id, s.pnm_id, s.total_votes, s.yes_count, s.no_count,
  s.unknown_count, s.favorite_count,
  CASE WHEN s.total_votes > 0 THEN ROUND((s.yes_count::numeric / s.total_votes), 4) ELSE 0 END AS yes_ratio,
  CASE WHEN s.weight_total > 0 THEN ROUND((s.weighted_sum / s.weight_total), 4) ELSE 0 END     AS weighted_score,
  ROUND(s.controversy_score, 2) AS controversy_score,
  (s.total_votes >= 5 AND s.controversy_score >= 2.0) AS controversial
FROM scoring s;

CREATE OR REPLACE VIEW v_votes_public AS
SELECT
  v.id, v.round_id, v.pnm_id,
  CASE WHEN COALESCE((vr.settings->>'anonymous')::boolean, false) THEN NULL ELSE v.voter_user_id END AS voter_user_id,
  v.value, v.favorite, v.voted_at
FROM votes v
JOIN voting_rounds vr ON vr.id = v.round_id;

-- ---------------------------------------------------------------------------
-- §12  Assertions -- the whole file rolls back if any invariant is unmet
-- ---------------------------------------------------------------------------

DO $recon_assert$
DECLARE
  missing text[] := '{}';
  t text;
  c text[];
BEGIN
  FOREACH t IN ARRAY ARRAY['users','chapters','memberships','pnms','tags','pnm_tags',
                           'voting_rounds','round_pnms','votes','sessions','events',
                           'event_attendance','pnm_notes','questionnaires','pnm_answers',
                           'bid_lists','bid_list_entries','audit_log','schema_reconciliation_log']
  LOOP
    IF NOT _recon_has_table(t) THEN missing := missing || t; END IF;
  END LOOP;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION '0013: missing required tables: %', array_to_string(missing, ', ');
  END IF;

  FOREACH t IN ARRAY ARRAY['voter_user_id','value','favorite','weight_applied','voted_at'] LOOP
    IF NOT _recon_has_col('votes', t) THEN
      RAISE EXCEPTION '0013: votes.% missing after reconciliation', t;
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['room_code','selected_pnm_ids','started_at','ended_at','settings','name'] LOOP
    IF NOT _recon_has_col('voting_rounds', t) THEN
      RAISE EXCEPTION '0013: voting_rounds.% missing after reconciliation', t;
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['email','phone','walkout_song','weirdest_talent','chick_fil_a_order','fun_fact','archived'] LOOP
    IF NOT _recon_has_col('pnms', t) THEN
      RAISE EXCEPTION '0013: pnms.% missing after reconciliation', t;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM memberships WHERE role NOT IN ('admin','exec','member','observer')) THEN
    RAISE EXCEPTION '0013: memberships.role has values outside the allowed set';
  END IF;

  IF EXISTS (SELECT 1 FROM voting_rounds WHERE type NOT IN ('GENERAL','INVITE','BID')) THEN
    RAISE EXCEPTION '0013: voting_rounds.type has values outside the allowed set';
  END IF;

  PERFORM _recon_log('assertions', 'passed');
END
$recon_assert$;

DROP FUNCTION IF EXISTS _recon_has_col(text, text);
DROP FUNCTION IF EXISTS _recon_has_table(text);

COMMIT;
