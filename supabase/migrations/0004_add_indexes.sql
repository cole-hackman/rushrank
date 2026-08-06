-- Performance indexes for RushRank
-- Run with: psql "$DATABASE_URL" -f supabase/migrations/0004_add_indexes.sql

-- PNMs table indexes
CREATE INDEX IF NOT EXISTS idx_pnms_chapter_id ON pnms(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pnms_created_at ON pnms(created_at DESC);

-- Votes table indexes (high volume)
CREATE INDEX IF NOT EXISTS idx_votes_round_id ON votes(round_id);
CREATE INDEX IF NOT EXISTS idx_votes_pnm_id ON votes(pnm_id);
CREATE INDEX IF NOT EXISTS idx_votes_round_pnm ON votes(round_id, pnm_id);

-- Guarded: legacy-origin databases have votes.voter_id, not voter_user_id.
-- 0013_reconcile_schema.sql adds the column and creates this index.
DO $mig0004_votes_idx$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'votes' AND column_name = 'voter_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_votes_voter_user_id ON votes(voter_user_id);
  ELSE
    RAISE NOTICE '0004: votes.voter_user_id absent (legacy shape); index deferred to 0013';
  END IF;
END
$mig0004_votes_idx$;

-- Memberships table indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_chapter_id ON memberships(chapter_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_chapter ON memberships(user_id, chapter_id);

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_chapter_id ON events(chapter_id);

-- Guarded: 0001 creates events with `starts_at`; the legacy schema and 0007 use
-- `date`. Index whichever exists so this file applies against either origin.
DO $mig0004_events_idx$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'starts_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at DESC);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);
  END IF;
END
$mig0004_events_idx$;

-- Event attendance table indexes (correct table name)
CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_pnm_id ON event_attendance(pnm_id);

-- Voting rounds table indexes (correct table name)
CREATE INDEX IF NOT EXISTS idx_voting_rounds_chapter_id ON voting_rounds(chapter_id);
CREATE INDEX IF NOT EXISTS idx_voting_rounds_status ON voting_rounds(status);

-- PNM tags table indexes
CREATE INDEX IF NOT EXISTS idx_pnm_tags_pnm_id ON pnm_tags(pnm_id);
CREATE INDEX IF NOT EXISTS idx_pnm_tags_tag_id ON pnm_tags(tag_id);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_round_id ON sessions(round_id);
CREATE INDEX IF NOT EXISTS idx_sessions_join_code ON sessions(join_code);

-- PNM notes table indexes (correct table name)
CREATE INDEX IF NOT EXISTS idx_pnm_notes_pnm_id ON pnm_notes(pnm_id);
CREATE INDEX IF NOT EXISTS idx_pnm_notes_created_at ON pnm_notes(created_at DESC);
