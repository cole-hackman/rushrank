-- 0012_bid_lists.sql
CREATE TYPE bid_bucket AS ENUM ('cut', 'maybe', 'bid');

CREATE TABLE IF NOT EXISTS bid_lists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
