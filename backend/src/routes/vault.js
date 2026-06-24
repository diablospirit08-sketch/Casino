/**
 * Vault routes
 *
 * GET  /api/vault          — balances + history for current user
 * POST /api/vault/lock     — move funds from wallet into vault
 * POST /api/vault/unlock   — move funds from vault back to wallet
 */

import { query, transaction } from '../db.js';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS vault_balances (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency   TEXT NOT NULL,
    amount     NUMERIC(20,8) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    PRIMARY KEY (user_id, currency)
  );
  CREATE TABLE IF NOT EXISTS vault_history (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('lock','unlock')),
    currency   TEXT NOT NULL,
    amount     NUMERIC(20,8) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(INIT_SQL);
  tableReady = true;
}

export async function vaultRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Get vault balances + recent history ──────────────────────────────────
  fastify.get('/', async (req) => {
    await ensureTable();
    const [balRows, histRows] = await Promise.all([
      query(`SELECT currency, amount FROM vault_balances WHERE user_id = $1`, [req.user.id]),
      query(
        `SELECT type, currency, amount, created_at
         FROM vault_history WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.user.id]
      ),
    ]);
    const balances = {};
    balRows.forEach(r => { balances[r.currency] = parseFloat(r.amount); });
    return { balances, history: histRows };
  });

  // ── Lock funds (wallet → vault) ──────────────────────────────────────────
  fastify.post('/lock', {
    schema: {
      body: {
        type: 'object',
        required: ['currency', 'amount'],
        properties: {
          currency: { type: 'string', minLength: 2, maxLength: 10 },
          amount:   { type: 'number', exclusiveMinimum: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    await ensureTable();
    const { currency, amount } = req.body;
    const userId = req.user.id;

    await transaction(async (client) => {
      const { rows: walletRows } = await client.query(
        `SELECT amount FROM balances WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
        [userId, currency]
      );
      const walletBal = parseFloat(walletRows[0]?.amount ?? 0);
      if (walletBal < amount) {
        const err = new Error('Insufficient wallet balance');
        err.statusCode = 400;
        throw err;
      }

      await client.query(
        `UPDATE balances SET amount = amount - $1 WHERE user_id = $2 AND currency = $3`,
        [amount, userId, currency]
      );
      await client.query(
        `INSERT INTO vault_balances (user_id, currency, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, currency) DO UPDATE SET amount = vault_balances.amount + $3`,
        [userId, currency, amount]
      );
      await client.query(
        `INSERT INTO vault_history (user_id, type, currency, amount) VALUES ($1, 'lock', $2, $3)`,
        [userId, currency, amount]
      );
    });

    return { ok: true, message: `${amount} ${currency} locked in vault.` };
  });

  // ── Unlock funds (vault → wallet) ────────────────────────────────────────
  fastify.post('/unlock', {
    schema: {
      body: {
        type: 'object',
        required: ['currency', 'amount'],
        properties: {
          currency: { type: 'string', minLength: 2, maxLength: 10 },
          amount:   { type: 'number', exclusiveMinimum: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    await ensureTable();
    const { currency, amount } = req.body;
    const userId = req.user.id;

    await transaction(async (client) => {
      const { rows: vaultRows } = await client.query(
        `SELECT amount FROM vault_balances WHERE user_id = $1 AND currency = $2 FOR UPDATE`,
        [userId, currency]
      );
      const vaultBal = parseFloat(vaultRows[0]?.amount ?? 0);
      if (vaultBal < amount) {
        const err = new Error('Insufficient vault balance');
        err.statusCode = 400;
        throw err;
      }

      await client.query(
        `UPDATE vault_balances SET amount = amount - $1 WHERE user_id = $2 AND currency = $3`,
        [amount, userId, currency]
      );
      await client.query(
        `INSERT INTO balances (user_id, currency, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, currency) DO UPDATE SET amount = balances.amount + $3`,
        [userId, currency, amount]
      );
      await client.query(
        `INSERT INTO vault_history (user_id, type, currency, amount) VALUES ($1, 'unlock', $2, $3)`,
        [userId, currency, amount]
      );
    });

    return { ok: true, message: `${amount} ${currency} returned to wallet.` };
  });
}
