-- ══════════════════════════════════════════════════════════════
-- VOLT Casino — Site config table
-- A single-row singleton (enforced by PRIMARY KEY = true) that
-- persists feature flags, house-edge overrides, and disabled games.
-- Run in Supabase SQL Editor OR apply via Railway migration.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_config (
  -- Singleton guard: only one row with id = true can ever exist.
  id              BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  feature_flags   JSONB   NOT NULL DEFAULT '{}',
  house_edges     JSONB   NOT NULL DEFAULT '{}',
  disabled_games  JSONB   NOT NULL DEFAULT '{}'
);

-- Seed the single row if it doesn't exist yet.
INSERT INTO site_config DEFAULT VALUES ON CONFLICT DO NOTHING;
