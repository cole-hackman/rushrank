-- Performance indexes for RushRank
-- Run with: psql "$DATABASE_URL" -f supabase/migrations/0004_add_indexes.sql

-- PNMs table indexes
CREATE INDEX IF NOT EXISTS idx_pnms_chapter_id ON pnms(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pnms_created_at ON pnms(created_at DESC);

-- Votes table indexes (high volume)
CREATE INDEX IF NOT EXISTS idx_votes_round_id ON votes(round_id);
CREATE INDEX IF NOT EXISTS idx_votes_pnm_id ON votes(pnm_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_user_id ON votes(voter_user_id);
CREATE INDEX IF NOT EXISTS idx_votes_round_pnm ON votes(round_id, pnm_id);

-- Memberships table indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_chapter_id ON memberships(chapter_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_chapter ON memberships(user_id, chapter_id);

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_chapter_id ON events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at DESC);

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
