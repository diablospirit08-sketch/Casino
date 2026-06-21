/**
 * Admin routes — all require auth + is_admin flag
 *
 * GET  /api/admin/stats             — dashboard summary numbers
 * GET  /api/admin/users             — paginated user list with balances
 * POST /api/admin/users/:id/ban     — ban or unban a user
 * GET  /api/admin/bets              — recent bets with username
 * GET  /api/admin/transactions      — ledger entries with username
 */

import { query } from '../db.js';

async function requireAdmin(req, reply) {
  const rows = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_admin) {
    return reply.code(403).send({ error: 'Admin access required' });
  }
}

export async function adminRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // ── Stats ──────────────────────────────────────────────────────────────────
  fastify.get('/stats', async () => {
    const [main, pending] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::int        FROM users)                                       AS total_users,
          (SELECT COUNT(*)::int        FROM bets  WHERE game != 'pending' AND created_at >= CURRENT_DATE) AS bets_today,
          (SELECT COALESCE(SUM(wager),0)::NUMERIC FROM bets WHERE game != 'pending' AND created_at >= CURRENT_DATE) AS wagered_today,
          (SELECT COALESCE(SUM(wager - COALESCE(payout,0)),0)::NUMERIC
             FROM bets WHERE game != 'pending' AND status IN ('won','lost'))              AS house_profit
      `),
      query(`SELECT COUNT(*)::int AS cnt FROM withdrawals WHERE status = 'pending'`),
    ]);
    return { ...main[0], pending_withdrawals: pending[0].cnt };
  });

  // ── Users ──────────────────────────────────────────────────────────────────
  fastify.get('/users', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          q:      { type: 'string', maxLength: 100 },
        },
      },
    },
  }, async (req) => {
    const { limit, offset, q } = req.query;
    const params = [limit, offset, q || null];
    const rows = await query(`
      SELECT
        u.id, u.username, u.email, u.is_admin, u.is_banned, u.kyc_status, u.created_at,
        COALESCE(l.balance, 0)::NUMERIC       AS bnb_balance,
        COALESCE(b.total_wagered, 0)::NUMERIC AS total_wagered
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS balance FROM ledger WHERE currency = 'BNB' GROUP BY user_id
      ) l ON l.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(wager) AS total_wagered FROM bets WHERE game != 'pending' GROUP BY user_id
      ) b ON b.user_id = u.id
      WHERE ($3::text IS NULL OR u.username ILIKE '%' || $3 || '%' OR u.email ILIKE '%' || $3 || '%')
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    return { users: rows, limit, offset };
  });

  // ── Ban / unban ────────────────────────────────────────────────────────────
  fastify.post('/users/:id/ban', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      body:   { type: 'object', required: ['banned'], properties: { banned: { type: 'boolean' } } },
    },
  }, async (req, reply) => {
    if (req.params.id === req.user.id) {
      return reply.code(400).send({ error: 'Cannot ban yourself' });
    }
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [req.body.banned, req.params.id]);
    return { ok: true };
  });

  // ── Bets ───────────────────────────────────────────────────────────────────
  fastify.get('/bets', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 200, default: 25 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          since:  { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const { limit, offset, since } = req.query;
    const params = [limit, offset, since || null];
    const rows = await query(`
      SELECT b.id, b.game, b.currency, b.wager, b.multiplier, b.payout, b.status, b.created_at,
        u.username
      FROM bets b
      JOIN users u ON u.id = b.user_id
      WHERE b.game != 'pending'
        AND ($3::text IS NULL OR b.created_at >= $3::timestamptz)
      ORDER BY b.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    return { bets: rows, limit, offset };
  });

  // ── Transactions (ledger) ──────────────────────────────────────────────────
  fastify.get('/transactions', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          type:   { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const { limit, offset, type } = req.query;
    const params = [limit, offset, type || null];
    const rows = await query(`
      SELECT l.id, l.type, l.currency, l.amount, l.ref_id, l.created_at,
        u.username, u.email
      FROM ledger l
      JOIN users u ON u.id = l.user_id
      WHERE ($3::text IS NULL OR l.type = $3)
      ORDER BY l.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    return { transactions: rows, limit, offset };
  });
}
