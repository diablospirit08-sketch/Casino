/**
 * Image storage routes
 *
 * POST /api/admin/upload  — admin only, uploads to Cloudinary (or DB fallback)
 * GET  /api/image/:key    — public fallback server (used when Cloudinary not configured)
 *
 * Cloudinary env vars (all required to enable Cloudinary):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

import { query } from '../db.js';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

/* ── Cloudinary ────────────────────────────────────────────────── */
function cloudinaryEnabled() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET);
}

function initCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  });
}

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err); else resolve(result);
    });
    stream.end(buffer);
  });
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

  if (cloudinaryEnabled()) initCloudinary();

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

    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(413).send({ error: 'Image too large (max 10 MB)' });
    }

    const publicId = `viofyre/${data.fieldname || 'img'}-${randomUUID().slice(0, 8)}`;

    /* ── Try Cloudinary first ── */
    if (cloudinaryEnabled()) {
      try {
        const result = await uploadToCloudinary(buffer, {
          public_id:    publicId,
          resource_type:'image',
          overwrite:    true,
          folder:       'viofyre',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        });
        return { url: result.secure_url };
      } catch (err) {
        fastify.log.error({ err }, 'Cloudinary upload failed, falling back to DB');
      }
    }

    /* ── DB fallback ── */
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'webp';
    const key = `${data.fieldname || 'img'}-${randomUUID().slice(0, 8)}.${ext}`;
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
