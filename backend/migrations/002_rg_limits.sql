-- ============================================================
-- Volt Casino — responsible gambling limit columns
-- Run once: psql $DATABASE_URL -f migrations/002_rg_limits.sql
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rg_wager_daily        NUMERIC(28,8),  -- per-currency daily wager cap
  ADD COLUMN IF NOT EXISTS rg_wager_weekly       NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rg_wager_monthly      NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rg_loss_daily         NUMERIC(28,8),  -- per-currency daily net-loss cap
  ADD COLUMN IF NOT EXISTS rg_loss_weekly        NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rg_loss_monthly       NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rg_deposit_daily      NUMERIC(28,8),  -- per-currency daily deposit cap
  ADD COLUMN IF NOT EXISTS rg_deposit_weekly     NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rg_deposit_monthly    NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rg_excluded_until     TIMESTAMPTZ,    -- NULL = not excluded
  ADD COLUMN IF NOT EXISTS rg_excluded_permanent BOOLEAN NOT NULL DEFAULT false;
