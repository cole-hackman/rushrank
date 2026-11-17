-- Both RLS policies on public.memberships queried public.memberships, so any
-- Data API read of memberships, or of a table whose policy subqueries it (pnms,
-- votes, notes, ...), failed with "infinite recursion detected in policy for
-- relation memberships" (SQLSTATE 42P17).
--
-- Move the membership lookup into SECURITY DEFINER helpers in an unexposed
-- schema. They run as their owner, which bypasses RLS, so the lookup no longer
-- re-enters the policy. The backend connects as the owner and is unaffected.
--
-- The policies come from the original Supabase-side schema and are not created
-- by earlier migrations, so they are only replaced where they exist. plpgsql
-- bodies are not checked at creation, which lets this run where auth.uid() does
-- not exist (plain Postgres in CI).

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_chapter_member(p_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid() AND m.chapter_id = p_chapter_id
  );
END $$;

CREATE OR REPLACE FUNCTION private.is_chapter_admin(p_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid() AND m.chapter_id = p_chapter_id AND m.role = 'admin'
  );
END $$;

REVOKE ALL ON FUNCTION private.is_chapter_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_chapter_admin(uuid)  FROM PUBLIC;

-- Roles that evaluate the policies need to call the helpers. These roles only
-- exist on Supabase.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA private TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION private.is_chapter_member(uuid) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION private.is_chapter_admin(uuid) TO %I', r);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
             AND tablename = 'memberships' AND policyname = 'Members can view chapter memberships') THEN
    DROP POLICY "Members can view chapter memberships" ON public.memberships;
    CREATE POLICY "Members can view chapter memberships" ON public.memberships
      FOR SELECT
      USING (auth.uid() = user_id OR private.is_chapter_member(chapter_id));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
             AND tablename = 'memberships' AND policyname = 'Admins can manage memberships') THEN
    DROP POLICY "Admins can manage memberships" ON public.memberships;
    CREATE POLICY "Admins can manage memberships" ON public.memberships
      FOR ALL
      USING (private.is_chapter_admin(chapter_id));
  END IF;
END $$;
