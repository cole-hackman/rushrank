-- 0012_bid_lists.sql
--
-- Two fixes applied during the 2026-08 schema cleanup, both of which prevented
-- this file from applying to a database that lacked the uuid-ossp extension
-- (i.e. any database created from supabase/migrations/ alone):
--   1. `CREATE TYPE bid_bucket` was unguarded, so re-running aborted.
--   2. The id defaults called uuid_generate_v4(), which needs uuid-ossp -- an
--      extension 0001 did not install. Switched to gen_random_uuid(), provided
--      by pgcrypto, which 0001 does install.
DO $mig0012_bucket$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_bucket') THEN
    CREATE TYPE bid_bucket AS ENUM ('cut', 'maybe', 'bid');
  END IF;
END
$mig0012_bucket$;

CREATE TABLE IF NOT EXISTS bid_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id      UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  source_round_id UUID REFERENCES voting_rounds(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  bid_cap         INT,
  locked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at       TIMESTAMPTZ,
  finalized_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bid_lists_chapter_idx
  ON bid_lists (chapter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bid_list_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_list_id   UUID NOT NULL REFERENCES bid_lists(id) ON DELETE CASCADE,
  pnm_id        UUID NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  bucket        bid_bucket NOT NULL DEFAULT 'maybe',
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bid_list_id, pnm_id)
);

CREATE INDEX IF NOT EXISTS bid_list_entries_list_bucket_idx
  ON bid_list_entries (bid_list_id, bucket, position);
