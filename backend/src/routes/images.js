/**
 * Image storage routes
 *
 * POST /api/admin/upload  — admin only, stores image in DB, returns { url }
 * GET  /api/image/:key    — public, serves image with cache headers
 */

import { query } from '../db.js';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS images (
    key        TEXT PRIMARY KEY,
    data       BYTEA NOT NULL,
    mime_type  TEXT NOT NULL DEFAULT 'image/webp',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(INIT_SQL);
  tableReady = true;
}

async function requireAdmin(req, reply) {
  const rows = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_admin) return reply.code(403).send({ error: 'Admin access required' });
}

export async function imageUploadRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('preHandler', requireAdmin);

  fastify.post('/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file provided' });

    const mime = data.mimetype;
    if (!mime.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only image files are allowed' });
    }

    const chunks = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length > 2 * 1024 * 1024) {
      return reply.code(413).send({ error: 'Image too large (max 2 MB)' });
    }

    const key = data.fieldname || `img_${Date.now()}`;
    await ensureTable();
    await query(
      `INSERT INTO images (key, data, mime_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $2, mime_type = $3, updated_at = NOW()`,
      [key, buffer, mime]
    );

    return { url: `/api/image/${key}` };
  });
}

export async function imageServeRoutes(fastify) {
  fastify.get('/:key', async (req, reply) => {
    await ensureTable();
    const rows = await query(
      'SELECT data, mime_type FROM images WHERE key = $1',
      [req.params.key]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Image not found' });

    reply
      .header('Content-Type', rows[0].mime_type)
      .header('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400')
      .send(rows[0].data);
  });
}
