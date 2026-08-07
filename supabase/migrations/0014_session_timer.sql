-- 0014_session_timer.sql
--
-- Server-authoritative per-PNM timer for live voting sessions.
--
-- The voting UI has always collected "seconds per PNM" and sent it as
-- `timer_seconds`, but POST /sessions dropped it on the floor and
-- GET /rounds/{id}/status returned a hardcoded `"timer_remaining": 165`. So the
-- control existed, looked functional, and did nothing.
--
-- The countdown is derived server-side from `current_pnm_started_at` rather
-- than each client running its own interval: in a room of forty phones,
-- independent client clocks drift apart within a minute, and the whole point of
-- the timer is that everyone is looking at the same number.
--
-- Additive and idempotent, consistent with 0013.

BEGIN;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timer_seconds integer;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_pnm_started_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sessions.timer_seconds IS
  'Seconds allotted per PNM. NULL means no timer for this session.';
COMMENT ON COLUMN sessions.current_pnm_started_at IS
  'When the chair advanced to the current PNM. Clients render '
  'timer_seconds - (now() - this) so every device shows the same countdown.';
COMMENT ON COLUMN sessions.anonymous IS
  'Secret-ballot mode. Votes are still stored per-voter (one vote per person is '
  'a hard requirement); anonymity is enforced at the read boundary via '
  'v_votes_public, which masks voter_user_id.';

-- Existing sessions have a current PNM but no start stamp; treat the session
-- start as the stamp so the first countdown is not negative.
UPDATE sessions
SET current_pnm_started_at = COALESCE(started_at, now())
WHERE current_pnm_id IS NOT NULL AND current_pnm_started_at IS NULL;

COMMIT;
