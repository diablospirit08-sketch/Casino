/**
 * Promo config routes
 *
 * GET  /api/promo          — public, returns current promo pair config
 * POST /api/admin/promo    — admin only, saves promo pair config
 */

import { query } from '../db.js';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS site_config (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(INIT_SQL);
  tableReady = true;
}

export async function promoPublicRoutes(fastify) {
  fastify.get('/promo', async () => {
    await ensureTable();
    const rows = await query(`SELECT value FROM site_config WHERE key = 'promo_pair'`);
    return rows[0]?.value ?? {};
  });
}

async function requireAdmin(req, reply) {
  const rows = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_admin) return reply.code(403).send({ error: 'Admin access required' });
}

export async function promoAdminRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', requireAdmin);
  fastify.post('/promo', async (req, reply) => {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return reply.code(400).send({ error: 'Invalid body' });
    }
    await ensureTable();
    await query(
      `INSERT INTO site_config (key, value, updated_at)
       VALUES ('promo_pair', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    return { ok: true };
  });
}
