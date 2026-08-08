BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- Legacy-origin databases were created by supabase/legacy/schema_pre_migrations.sql,
-- which used uuid_generate_v4(). Install uuid-ossp so those defaults keep resolving
-- and so 0012 applies on a database that never had it.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
    CREATE TYPE role_type AS ENUM ('ADMIN','EXEC','BROTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'round_type') THEN
    CREATE TYPE round_type AS ENUM ('GENERAL','INVITE','BID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'round_status') THEN
    CREATE TYPE round_status AS ENUM ('DRAFT','ACTIVE','LOCKED','ENDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_value') THEN
    CREATE TYPE vote_value AS ENUM ('YES','NO','UNKNOWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_method') THEN
    CREATE TYPE attendance_method AS ENUM ('SEARCH','QR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'export_type') THEN
    CREATE TYPE export_type AS ENUM ('CSV','PNM_CARD');
  END IF;
END$$;

-- Core tables
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  email citext NOT NULL UNIQUE,
  name text,
  role role_type NOT NULL DEFAULT 'BROTHER',
  is_exec boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_allowlist (
  email citext PRIMARY KEY,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  role role_type NOT NULL DEFAULT 'BROTHER',
  active boolean NOT NULL DEFAULT true,
  invited_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member', 'observer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS pnms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  email citext,
  phone text,
  hometown text,
  major text,
  year text,
  photo_url text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text,
  UNIQUE (chapter_id, label)
);

CREATE TABLE IF NOT EXISTS pnm_tags (
  pnm_id uuid NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (pnm_id, tag_id)
);

CREATE TABLE IF NOT EXISTS questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  schema jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pnm_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pnm_id uuid NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  questionnaire_id uuid REFERENCES questionnaires(id) ON DELETE SET NULL,
  answers jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  location text,
  notes text
);

CREATE TABLE IF NOT EXISTS event_attendance (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pnm_id uuid NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  checked_in_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  method attendance_method NOT NULL DEFAULT 'SEARCH',
  PRIMARY KEY (event_id, pnm_id)
);

CREATE TABLE IF NOT EXISTS voting_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name text,
  type round_type NOT NULL,
  status round_status NOT NULL DEFAULT 'DRAFT',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS round_pnms (
  round_id uuid NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
  pnm_id uuid NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  order_index integer,
  PRIMARY KEY (round_id, pnm_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
  pnm_id uuid NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  voter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value vote_value NOT NULL,
  favorite boolean NOT NULL DEFAULT false,
  weight_applied numeric NOT NULL DEFAULT 1.0,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, pnm_id, voter_user_id)
);

CREATE TABLE IF NOT EXISTS pnm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pnm_id uuid NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  anonymous boolean NOT NULL DEFAULT true,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,
  current_pnm_id uuid REFERENCES pnms(id) ON DELETE SET NULL,
  locked boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type export_type NOT NULL,
  url text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

COMMIT;

-- DOWN (for reference; use Alembic for controlled downgrades)
-- DROP VIEW IF EXISTS v_round_rankings;
-- DROP VIEW IF EXISTS v_votes_public;
-- DROP MATERIALIZED VIEW IF EXISTS mv_pnms_search;
-- DROP TABLE IF EXISTS exports, sessions, pnm_notes, votes, round_pnms, voting_rounds, event_attendance, events, pnm_answers, questionnaires, pnm_tags, tags, pnms, memberships, email_allowlist, users, chapters CASCADE;
-- DROP TYPE IF EXISTS export_type, attendance_method, vote_value, round_status, round_type, role_type;

