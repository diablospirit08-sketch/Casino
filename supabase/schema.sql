-- ============================================================
--  VOLT Casino — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. profiles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  avatar_url  TEXT,
  vip_level   INT  DEFAULT 0,
  vip_xp      BIGINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, SPLIT_PART(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. wallets ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency    TEXT NOT NULL,
  balance     NUMERIC(20, 8) DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, currency)
);

-- keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS wallets_updated_at ON public.wallets;
CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('deposit','withdraw','bonus')),
  currency    TEXT NOT NULL,
  amount      NUMERIC(20, 8) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','completed','failed','cancelled')),
  tx_hash     TEXT,
  address     TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. bets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game        TEXT NOT NULL,
  currency    TEXT NOT NULL,
  wager       NUMERIC(20, 8) NOT NULL CHECK (wager > 0),
  multiplier  NUMERIC(12, 4),
  profit      NUMERIC(20, 8),
  outcome     TEXT CHECK (outcome IN ('win','loss','push')),
  game_data   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Row Level Security ────────────────────────────────────
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets         ENABLE ROW LEVEL SECURITY;

-- profiles: users see/edit only their own
CREATE POLICY "profiles: own read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- wallets: users see/edit only their own
CREATE POLICY "wallets: own read"   ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets: own write"  ON public.wallets FOR ALL    USING (auth.uid() = user_id);

-- transactions: users see only their own; insert only
CREATE POLICY "transactions: own read"   ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions: own insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bets: users see/insert only their own
CREATE POLICY "bets: own read"   ON public.bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bets: own insert" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 6. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallets_user      ON public.wallets      (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions  (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_user         ON public.bets          (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_game         ON public.bets          (game, created_at DESC);

-- ── 7. balances view (backwards-compat with old balances.js) ─
-- Drop the old balances table if it exists, then create a view in its place
DROP TABLE IF EXISTS public.balances CASCADE;
CREATE OR REPLACE VIEW public.balances AS
  SELECT user_id, currency, balance AS amount FROM public.wallets;
