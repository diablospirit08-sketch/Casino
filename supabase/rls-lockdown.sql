-- ============================================================
--  VOLT Casino — Wallet RLS Lockdown
--  Run in Supabase Dashboard → SQL Editor
--
--  Removes direct wallet UPDATE/DELETE from browser clients.
--  Balance changes now flow exclusively through settle_bet()
--  (SECURITY DEFINER, called by the place-bet Edge Function).
-- ============================================================

-- ── Drop the permissive catch-all wallet policy ──────────────
DROP POLICY IF EXISTS "wallets: own write" ON public.wallets;

-- ── Replace with minimal scoped policies ────────────────────
-- SELECT: user reads own balance (needed by balances.js)
DROP POLICY IF EXISTS "wallets: own read"   ON public.wallets;
CREATE POLICY "wallets: own read"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: user can create their own wallet rows (needed on first login)
DROP POLICY IF EXISTS "wallets: own insert" ON public.wallets;
CREATE POLICY "wallets: own insert"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy for users.
-- settle_bet() runs as SECURITY DEFINER (service role) → bypasses RLS.
-- No browser client can now call: supabase.from('wallets').update(...)

-- ── Also lock down bets — no direct browser inserts ─────────
-- settle_bet() inserts bets via service role, so users don't need INSERT.
DROP POLICY IF EXISTS "bets: own insert" ON public.bets;

-- Users can still read their own bet history.

-- ── Verify (optional — review the remaining policies) ────────
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'wallets';
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'bets';
