/**
 * Image storage routes
 *
 * POST /api/admin/upload  — admin only, uploads to R2 (or DB fallback), returns { url }
 * GET  /api/image/:key    — public fallback server (used when R2 not configured)
 *
 * Cloudflare R2 env vars (all required to enable R2):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 */

import { query } from '../db.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

/* ── R2 client (lazy init) ─────────────────────────────────────── */
let s3 = null;
function getS3() {
  if (s3) return s3;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return s3;
}

function r2Enabled() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
            process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME &&
            process.env.R2_PUBLIC_URL);
}

/* ── DB fallback ───────────────────────────────────────────────── */
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

/* ── Upload handler ────────────────────────────────────────────── */
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

    if (buffer.length > 5 * 1024 * 1024) {
      return reply.code(413).send({ error: 'Image too large (max 5 MB)' });
    }

    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'webp';
    const key = `${data.fieldname || 'img'}-${randomUUID().slice(0, 8)}.${ext}`;

    /* ── Try R2 first ── */
    if (r2Enabled()) {
      try {
        await getS3().send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000',
        }));
        const url = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
        return { url };
      } catch (err) {
        fastify.log.error({ err }, 'R2 upload failed, falling back to DB');
      }
    }

    /* ── DB fallback ── */
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

/* ── DB fallback image server ──────────────────────────────────── */
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
