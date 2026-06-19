-- ============================================================
--  VOLT Casino — Fix profiles RLS infinite recursion
--  Run in: Supabase Dashboard → SQL Editor → New query
--
--  Problem: admin-rls.sql created "profiles: admin read" which
--  queries the profiles table from within a profiles SELECT policy,
--  causing infinite recursion (error code 42P17).
--
--  Fix: Drop the recursive policy. The correct admin read policy
--  ("admin: read all profiles") from admin-schema.sql uses the
--  is_admin() SECURITY DEFINER function which bypasses RLS.
-- ============================================================

-- Drop the recursive policy created by admin-rls.sql
DROP POLICY IF EXISTS "profiles: admin read" ON public.profiles;

-- Ensure the correct is_admin() helper exists (from admin-schema.sql)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Ensure the correct admin-read policy exists (non-recursive)
DROP POLICY IF EXISTS "admin: read all profiles" ON public.profiles;
CREATE POLICY "admin: read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());
