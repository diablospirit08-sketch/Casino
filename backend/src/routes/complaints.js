/**
 * Complaint routes
 *
 * POST /api/complaints  — submit a complaint (public, rate-limited by Fastify global limiter)
 * GET  /api/admin/complaints — admin only, list all complaints
 */

import { query } from '../db.js';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS complaints (
    id          SERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    name        TEXT,
    email       TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general',
    subject     TEXT NOT NULL,
    message     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(INIT_SQL);
  tableReady = true;
}

const VALID_CATEGORIES = ['account', 'payment', 'game', 'bonus', 'technical', 'general'];

export async function complaintRoutes(fastify) {
  fastify.post('/complaints', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'subject', 'message'],
        properties: {
          name:     { type: 'string', maxLength: 80 },
          email:    { type: 'string', format: 'email', maxLength: 254 },
          category: { type: 'string', enum: VALID_CATEGORIES },
          subject:  { type: 'string', minLength: 4, maxLength: 120 },
          message:  { type: 'string', minLength: 10, maxLength: 4000 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { name, email, category = 'general', subject, message } = req.body;

    // Attach user_id if logged in (optional)
    let userId = null;
    try {
      await req.jwtVerify();
      userId = req.user?.id ?? null;
    } catch (_) {}

    await ensureTable();
    await query(
      `INSERT INTO complaints (user_id, name, email, category, subject, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, name || null, email.toLowerCase(), category, subject, message]
    );

    reply.code(201).send({ ok: true, message: 'Your complaint has been submitted. We aim to respond within 48 hours.' });
  });
}

export async function complaintAdminRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/complaints', async (req, reply) => {
    const rows = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_admin) return reply.code(403).send({ error: 'Admin only' });

    await ensureTable();
    const complaints = await query(
      `SELECT id, name, email, category, subject, message, status, created_at
       FROM complaints ORDER BY created_at DESC LIMIT 200`
    );
    return { complaints };
  });
}
