-- ══════════════════════════════════════════════════════════════
-- VOLT Casino — Admin RLS policies
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ══════════════════════════════════════════════════════════════
--
-- These policies enforce server-side that only is_admin=true users
-- can read other users' data or approve/reject transactions.
-- Without these, the client-side check in admin.html is the only
-- barrier and can be bypassed from the browser console.
-- ══════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────
-- Users can read/update their own profile.
-- Admins can read all profiles.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: own read"   ON profiles;
DROP POLICY IF EXISTS "profiles: own update" ON profiles;
DROP POLICY IF EXISTS "profiles: admin read" ON profiles;

CREATE POLICY "profiles: own read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: admin read"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- ── wallets ───────────────────────────────────────────────────
-- Users can read their own wallet rows.
-- Admins can read all wallets.
-- Only the server (service role) can insert/update wallet balances.

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets: own read"   ON wallets;
DROP POLICY IF EXISTS "wallets: own insert" ON wallets;
DROP POLICY IF EXISTS "wallets: admin read" ON wallets;

CREATE POLICY "wallets: own read"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "wallets: own insert"
  ON wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wallets: admin read"
  ON wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- ── bets ──────────────────────────────────────────────────────
-- Users can insert their own bets and read their own history.
-- Admins can read all bets.

ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bets: own insert" ON bets;
DROP POLICY IF EXISTS "bets: own read"   ON bets;
DROP POLICY IF EXISTS "bets: admin read" ON bets;

CREATE POLICY "bets: own insert"
  ON bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bets: own read"
  ON bets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bets: admin read"
  ON bets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- ── transactions ─────────────────────────────────────────────
-- Users can insert and read their own transactions.
-- Only admins can update (approve / reject) transactions.

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: own insert" ON transactions;
DROP POLICY IF EXISTS "transactions: own read"   ON transactions;
DROP POLICY IF EXISTS "transactions: admin read"   ON transactions;
DROP POLICY IF EXISTS "transactions: admin update" ON transactions;

CREATE POLICY "transactions: own insert"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: own read"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions: admin read"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "transactions: admin update"
  ON transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
