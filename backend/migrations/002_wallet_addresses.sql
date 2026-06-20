-- ============================================================
-- Wallet addresses — link user accounts to on-chain wallets
-- ============================================================

-- One wallet address per user per network.
-- The player's own wallet address is the deposit identifier —
-- when VoltVault emits Deposited(player, amount), we look up
-- which user owns that player address and credit their ledger.
CREATE TABLE IF NOT EXISTS wallet_addresses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address    TEXT        NOT NULL,          -- checksummed 0x... address
  network    TEXT        NOT NULL,          -- bsc | bsc_testnet | mainnet …
  verified   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (address, network)
);

CREATE INDEX IF NOT EXISTS wa_user_idx    ON wallet_addresses(user_id);
CREATE INDEX IF NOT EXISTS wa_address_idx ON wallet_addresses(address, network);

-- Track withdrawal nonces per (user, network) to prevent voucher replay.
-- The contract tracks usedVouchers by digest, but we keep our own nonce
-- counter so we never sign two vouchers with the same nonce.
CREATE TABLE IF NOT EXISTS withdrawal_nonces (
  user_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network TEXT    NOT NULL,
  nonce   BIGINT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, network)
);

-- On-chain deposit records (dedup by tx_hash + log_index)
CREATE TABLE IF NOT EXISTS onchain_deposits (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  network          TEXT          NOT NULL,
  tx_hash          TEXT          NOT NULL,
  log_index        INT           NOT NULL DEFAULT 0,
  player_address   TEXT          NOT NULL,
  amount_wei       NUMERIC(38,0) NOT NULL,   -- raw wei
  amount_bnb       NUMERIC(28,8) NOT NULL,   -- converted
  block_number     BIGINT        NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','credited','failed')),
  credit_ledger_id UUID REFERENCES ledger(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS od_user_idx   ON onchain_deposits(user_id);
CREATE INDEX IF NOT EXISTS od_status_idx ON onchain_deposits(status) WHERE status = 'pending';
