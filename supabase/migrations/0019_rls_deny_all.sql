-- 0019_rls_deny_all.sql
--
-- Close the Supabase REST API to the public key.
--
-- The web app never reads a table through the Supabase client: every read and
-- write goes through the FastAPI backend, which connects as the table owner
-- and is not subject to row-level security. But the anon key ships to every
-- browser, and Supabase's REST API will serve any table that role may select
-- from. Only the tables in the original schema ever had row-level security;
-- no migration enabled it on the tables added since.
--
-- This migration:
--   1. enables row-level security on every table in `public`, with no new
--      policies, so a table without a policy returns nothing;
--   2. revokes every privilege on tables, views and sequences in `public`
--      from the `anon` and `authenticated` roles, so the REST API refuses
--      outright instead of filtering;
--   3. marks the two views as security_invoker, so they can never be used to
--      read around the tables' row-level security;
--   4. stops future tables from being granted to those roles by default.
--
-- Existing policies are left in place. They are unreachable once the grants
-- are gone and can be dropped later.
--
-- The backend is unaffected: it connects with DATABASE_URL as the owner.
-- Supabase Auth and Storage are unaffected: they live in other schemas.
--
-- Idempotent. On a plain Postgres with no `anon` role (local, CI) step 2 and
-- step 4 are skipped.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v record;
BEGIN
  -- security_invoker exists from PostgreSQL 15.
  IF current_setting('server_version_num')::int >= 150000 THEN
    FOR v IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
    LOOP
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.relname);
    END LOOP;
  END IF;
END $$;
