/**
 * Game art routes
 *
 * GET  /api/game-art          — public, returns saved game art map {slug: url}
 * POST /api/admin/game-art    — admin only, saves game art map
 */

import { query } from '../db.js';

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS site_config (
      key         TEXT PRIMARY KEY,
      value       JSONB NOT NULL,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`);
  tableReady = true;
}

async function requireAdmin(req, reply) {
  const rows = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_admin) return reply.code(403).send({ error: 'Admin access required' });
}

export async function gameArtPublicRoutes(fastify) {
  fastify.get('/game-art', async () => {
    await ensureTable();
    const rows = await query(`SELECT value FROM site_config WHERE key = 'game_art'`);
    return rows[0]?.value ?? {};
  });
}

export async function gameArtAdminRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', requireAdmin);

  fastify.post('/game-art', async (req, reply) => {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return reply.code(400).send({ error: 'Invalid body' });
    }
    await ensureTable();
    await query(
      `INSERT INTO site_config (key, value, updated_at)
       VALUES ('game_art', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    return { ok: true };
  });
}
