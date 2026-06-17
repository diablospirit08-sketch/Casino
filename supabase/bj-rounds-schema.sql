-- ============================================================
--  VOLT Casino — Blackjack Pending Rounds
--  Run in Supabase Dashboard → SQL Editor after schema.sql
-- ============================================================

-- Stores one row per in-flight blackjack hand.  The deal-blackjack
-- Edge Function inserts it; place-bet deletes it on settlement.
-- Orphaned rows (player closed mid-hand) are harmless and can be
-- pruned with:  DELETE FROM public.bj_rounds WHERE created_at < NOW() - INTERVAL '2 hours';

CREATE TABLE IF NOT EXISTS public.bj_rounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_seed TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bj_rounds ENABLE ROW LEVEL SECURITY;
-- Edge Functions use service role — no browser access needed.

CREATE INDEX IF NOT EXISTS idx_bj_rounds_user
  ON public.bj_rounds (user_id, created_at);
