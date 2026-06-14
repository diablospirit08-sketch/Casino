-- ============================================================
--  VOLT Casino — Admin Schema
--  Run in Supabase Dashboard → SQL Editor after schema.sql
-- ============================================================

-- ── 1. Add admin fields to profiles ─────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Update new-user trigger to capture email ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (NEW.id, SPLIT_PART(NEW.email,'@',1), NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- ── 3. is_admin() helper (avoids recursive RLS) ──────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- ── 4. Admin read-all policies ───────────────────────────────
DROP POLICY IF EXISTS "admin: read all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "admin: read all wallets"      ON public.wallets;
DROP POLICY IF EXISTS "admin: read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "admin: read all bets"         ON public.bets;
DROP POLICY IF EXISTS "admin: update transactions"   ON public.transactions;

CREATE POLICY "admin: read all profiles"     ON public.profiles     FOR SELECT USING (public.is_admin());
CREATE POLICY "admin: read all wallets"      ON public.wallets      FOR SELECT USING (public.is_admin());
CREATE POLICY "admin: read all transactions" ON public.transactions  FOR SELECT USING (public.is_admin());
CREATE POLICY "admin: read all bets"         ON public.bets         FOR SELECT USING (public.is_admin());
CREATE POLICY "admin: update transactions"   ON public.transactions  FOR UPDATE USING (public.is_admin());

-- ── 5. admin_stats() RPC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN (
    SELECT json_build_object(
      'total_users',   (SELECT COUNT(*)                        FROM public.profiles),
      'total_bets',    (SELECT COUNT(*)                        FROM public.bets),
      'bets_today',    (SELECT COUNT(*)                        FROM public.bets         WHERE created_at >= CURRENT_DATE),
      'wagered_today', (SELECT COALESCE(SUM(wager), 0)         FROM public.bets         WHERE created_at >= CURRENT_DATE),
      'pending_tx',    (SELECT COUNT(*)                        FROM public.transactions  WHERE status = 'pending'),
      'house_profit',  (SELECT COALESCE(-SUM(profit), 0)       FROM public.bets)
    )
  );
END;
$$;

-- ── 6. Enable Realtime on bets and transactions ───────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- ── 7. To make your account admin, run: ──────────────────────
-- UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com';
