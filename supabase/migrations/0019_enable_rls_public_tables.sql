-- Supabase advisor: rls_disabled_in_public (2026-11-14).
--
-- 16 public tables had RLS off, so anyone holding the anon key could read and
-- write them through the Data API. The frontend never queries tables directly
-- (auth only) and the backend connects as the table owner, which bypasses RLS,
-- so enabling RLS with no policies denies anon/authenticated and breaks nothing.
-- Add policies in a later migration only if the frontend starts reading a
-- table directly.
--
-- The two public views are owned by postgres and bypass RLS, so they would keep
-- leaking vote data to anon after the tables are locked. Make them run with the
-- caller's rights and drop anon's access.

ALTER TABLE IF EXISTS public.audit_log                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bid_list_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bid_lists                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_allowlist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exports                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fraternity_colors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pnm_answers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pnm_contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pnm_notes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pnm_tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questionnaires            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.round_pnms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schema_reconciliation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tags                      ENABLE ROW LEVEL SECURITY;

ALTER VIEW IF EXISTS public.v_round_rankings SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_votes_public   SET (security_invoker = true);

-- The anon role only exists on Supabase, not on the plain Postgres used in CI.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    IF to_regclass('public.v_round_rankings') IS NOT NULL THEN
      REVOKE ALL ON public.v_round_rankings FROM anon;
    END IF;
    IF to_regclass('public.v_votes_public') IS NOT NULL THEN
      REVOKE ALL ON public.v_votes_public FROM anon;
    END IF;
  END IF;
END $$;

-- Catch-all: databases built only from migrations never enabled RLS on the core
-- tables (users, chapters, ...); production got it from the Supabase-origin
-- schema. Enable it anywhere it is still off so both origins match.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
