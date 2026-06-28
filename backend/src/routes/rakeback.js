/**
 * Rakeback routes
 *
 * GET  /api/rakeback        — claimable amount for current user
 * POST /api/rakeback/claim  — credit claimable rakeback to balance
 */

import { query, transaction } from '../db.js';

const HOUSE_EDGE = {
  dice:      0.01,
  crash:     0.03,
  mines:     0.025,
  plinko:    0.02,
  limbo:     0.01,
  coinflip:  0.02,
  keno:      0.04,
  blackjack: 0.005,
};
const RAKEBACK_RATE = 0.10;
const CURRENCY = 'BNB';

function gameEdge(game) {
  const key = game.replace(/^originals-/i, '').toLowerCase();
  return HOUSE_EDGE[key] ?? 0.02;
}

async function calcClaimable(userId, claimedAt) {
  const rows = await query(`
    SELECT game, wager FROM bets
    WHERE user_id = $1
      AND status IN ('won', 'lost')
      AND game != 'pending'
      AND currency = $2
      AND created_at > $3
  `, [userId, CURRENCY, claimedAt]);

  const total = rows.reduce((sum, b) => sum + parseFloat(b.wager) * gameEdge(b.game) * RAKEBACK_RATE, 0);
  return Math.floor(total * 1e8) / 1e8; // 8 decimal places
}

export async function rakebackRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Claimable amount ─────────────────────────────────────────────────────
  fastify.get('/', async (req) => {
    const rows = await query('SELECT rakeback_claimed_at FROM users WHERE id = $1', [req.user.id]);
    const claimedAt = rows[0]?.rakeback_claimed_at ?? new Date(0);
    const claimable = await calcClaimable(req.user.id, claimedAt);
    return { claimable, currency: CURRENCY, rate: RAKEBACK_RATE };
  });

  // ── Claim ────────────────────────────────────────────────────────────────
  fastify.post('/claim', async (req, reply) => {
    await transaction(async (client) => {
      const uRows = await client.query(
        'SELECT rakeback_claimed_at FROM users WHERE id = $1 FOR UPDATE',
        [req.user.id]
      );
      const claimedAt = uRows.rows[0]?.rakeback_claimed_at ?? new Date(0);
      const claimable = await calcClaimable(req.user.id, claimedAt);

      if (claimable < 0.000001) {
        reply.code(400).send({ error: 'Nothing to claim' });
        return;
      }

      await client.query(
        'UPDATE users SET rakeback_claimed_at = NOW() WHERE id = $1',
        [req.user.id]
      );

      await client.query(`
        INSERT INTO ledger (user_id, type, currency, amount, ref_id)
        VALUES ($1, 'rakeback', $2, $3, NULL)
      `, [req.user.id, CURRENCY, claimable]);
    });

    if (reply.sent) return;

    const balRows = await query(
      'SELECT COALESCE(SUM(amount),0)::NUMERIC AS balance FROM ledger WHERE user_id=$1 AND currency=$2',
      [req.user.id, CURRENCY]
    );
    return { ok: true, credited: true, balance: balRows[0].balance };
  });
}
