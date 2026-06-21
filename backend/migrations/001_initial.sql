-- ============================================================
-- Volt Casino — initial schema
-- Run once against a fresh PostgreSQL database.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  username      TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  kyc_status    TEXT        NOT NULL DEFAULT 'none'
                            CHECK (kyc_status IN ('none','pending','approved','rejected')),
  is_banned     BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- ────────────────────────────────────────────────────────────
-- REFRESH TOKENS  (JWT rotation)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rt_user_idx ON refresh_tokens(user_id);

-- ────────────────────────────────────────────────────────────
-- DEPOSIT ADDRESSES
-- One address per user per currency+network pair.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposit_addresses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency   TEXT        NOT NULL,   -- BTC | ETH | USDC | BNB …
  network    TEXT        NOT NULL,   -- mainnet | bsc | polygon …
  address    TEXT        UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, currency, network)
);

-- ────────────────────────────────────────────────────────────
-- LEDGER  (immutable — never UPDATE or DELETE rows)
--
-- Positive amount = credit to user.
-- Negative amount = debit from user.
--
-- Balance for a user+currency = SUM(amount) WHERE user_id = ? AND currency = ?
-- Always compute balance inside a transaction with FOR SHARE on the rows.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type       TEXT        NOT NULL
             CHECK (type IN (
               'deposit',       -- crypto received on deposit address
               'withdrawal',    -- crypto sent to user
               'withdrawal_fee',-- fee deducted on withdrawal
               'bet_debit',     -- wager placed
               'bet_credit',    -- payout on win
               'bonus',         -- promotional credit
               'rakeback',      -- rakeback claim
               'adjustment'     -- manual admin correction
             )),
  currency   TEXT        NOT NULL,
  amount     NUMERIC(28,8) NOT NULL,  -- positive = credit, negative = debit
  ref_id     TEXT,                    -- tx hash, bet id, etc.
  meta       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_user_currency_idx ON ledger(user_id, currency);
CREATE INDEX IF NOT EXISTS ledger_ref_id_idx        ON ledger(ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_type_idx          ON ledger(type);
CREATE INDEX IF NOT EXISTS ledger_created_idx       ON ledger(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- BETS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bets (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  game             TEXT          NOT NULL,
  currency         TEXT          NOT NULL,
  wager            NUMERIC(28,8) NOT NULL CHECK (wager > 0),
  multiplier       NUMERIC(12,4),
  payout           NUMERIC(28,8),
  -- Provably fair fields
  server_seed_hash TEXT          NOT NULL,  -- SHA-256(server_seed), shown before bet
  server_seed      TEXT,                    -- revealed after settlement
  client_seed      TEXT          NOT NULL DEFAULT '',
  nonce            BIGINT        NOT NULL DEFAULT 0,
  -- Outcome
  result           JSONB         NOT NULL DEFAULT '{}',
  status           TEXT          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','won','lost','cancelled')),
  -- Accounting link
  debit_ledger_id  UUID REFERENCES ledger(id),
  credit_ledger_id UUID REFERENCES ledger(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  settled_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bets_user_idx    ON bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bets_game_idx    ON bets(game);
CREATE INDEX IF NOT EXISTS bets_status_idx  ON bets(status) WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- WITHDRAWALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  currency      TEXT          NOT NULL,
  network       TEXT          NOT NULL,
  amount        NUMERIC(28,8) NOT NULL CHECK (amount > 0),
  fee           NUMERIC(28,8) NOT NULL DEFAULT 0,
  address       TEXT          NOT NULL,
  tx_hash       TEXT,
  status        TEXT          NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','sent','confirmed','failed')),
  debit_ledger_id UUID REFERENCES ledger(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS withdrawals_user_idx    ON withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx  ON withdrawals(status);

-- ────────────────────────────────────────────────────────────
-- DEPOSITS  (incoming on-chain transactions)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposits (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  currency         TEXT          NOT NULL,
  network          TEXT          NOT NULL,
  amount           NUMERIC(28,8) NOT NULL,
  tx_hash          TEXT          UNIQUE NOT NULL,
  confirmations    INT           NOT NULL DEFAULT 0,
  required_confs   INT           NOT NULL DEFAULT 3,
  status           TEXT          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','credited','failed')),
  credit_ledger_id UUID REFERENCES ledger(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deposits_user_idx   ON deposits(user_id);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON deposits(status) WHERE status IN ('pending','confirmed');

-- ────────────────────────────────────────────────────────────
-- HELPER: auto-update updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at') THEN
    CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'withdrawals_updated_at') THEN
    CREATE TRIGGER withdrawals_updated_at
      BEFORE UPDATE ON withdrawals
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'deposits_updated_at') THEN
    CREATE TRIGGER deposits_updated_at
      BEFORE UPDATE ON deposits
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
