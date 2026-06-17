-- ============================================================
--  VOLT Casino — Mines Pending Rounds
--  Run in Supabase Dashboard → SQL Editor after schema.sql
-- ============================================================

-- Stores one row per in-flight mines round.  deal-mines inserts it;
-- place-bet deletes it on settlement (cashout or bust).
-- Orphaned rows (player closed mid-round) are pruned with:
--   DELETE FROM public.mines_rounds WHERE created_at < NOW() - INTERVAL '2 hours';

CREATE TABLE IF NOT EXISTS public.mines_rounds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_seed  TEXT NOT NULL,
  mines_count  INT  NOT NULL CHECK (mines_count BETWEEN 1 AND 24),
  safe_tiles   INT[] NOT NULL DEFAULT '{}',  -- tile indices revealed safe so far
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mines_rounds ENABLE ROW LEVEL SECURITY;
-- Edge Functions use service role — no browser access needed.

CREATE INDEX IF NOT EXISTS idx_mines_rounds_user
  ON public.mines_rounds (user_id, created_at);
