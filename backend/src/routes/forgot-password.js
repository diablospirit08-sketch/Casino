/**
 * Forgot / reset password routes
 *
 * POST /api/auth/forgot-password  — send reset email (public)
 * POST /api/auth/reset-password   — consume token + set new password (public)
 *
 * Email is sent via Resend (https://resend.com).
 * Set RESEND_API_KEY and RESEND_FROM in Railway env vars:
 *   RESEND_API_KEY=re_xxxx
 *   RESEND_FROM=VioFyre Casino <noreply@yourdomain.com>
 *
 * If RESEND_API_KEY is not set the endpoint still creates the token but
 * returns 503 so the user knows email is not configured.
 */

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { query } from '../db.js';

const scryptAsync = promisify(scrypt);
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key  = await scryptAsync(password, salt, 64, SCRYPT_PARAMS);
  return `${salt}:${key.toString('hex')}`;
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function sendResetEmail(to, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const from = process.env.RESEND_FROM || 'VioFyre Casino <noreply@viofyre.com>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your VioFyre password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#0a0c15;color:#fff;border-radius:16px">
          <img src="https://casino-production-2759.up.railway.app/images/icon.jpg%20(8).png" width="48" style="border-radius:12px;margin-bottom:20px;display:block">
          <h2 style="margin:0 0 12px;font-size:22px;font-weight:800">Reset your password</h2>
          <p style="color:#8e8aaa;margin:0 0 28px;line-height:1.6;font-size:14px">Click the button below to choose a new password. This link expires in <b style="color:#fff">1 hour</b>.</p>
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(90deg,#3264d4,#5b8af5);color:#fff;font-weight:700;padding:14px 32px;border-radius:99px;text-decoration:none;font-size:14px;letter-spacing:.04em">Reset Password</a>
          <p style="color:#5a607a;font-size:11px;margin-top:32px;line-height:1.6">If you didn't request a password reset, you can safely ignore this email. Your password won't change.</p>
        </div>`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Resend error ${res.status}`);
  }
}

export async function forgotPasswordRoutes(fastify) {
  await ensureTable();

  // ── Request reset email ──────────────────────────────────────────────────
  fastify.post('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { email } = req.body;

    const rows = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    // Always return ok to prevent email enumeration
    if (!rows.length) return { ok: true };

    const userId = rows[0].id;
    const token  = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    // Invalidate any existing unused tokens for this user
    await query(
      `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [userId]
    );
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://casino-production-2759.up.railway.app';
    const resetUrl = `${frontendUrl}?reset=${token}`;

    try {
      await sendResetEmail(email, resetUrl);
    } catch (err) {
      fastify.log.error({ err, email }, 'Password reset email failed');
      return reply.code(503).send({ error: 'Failed to send reset email — please try again or contact support.' });
    }

    return { ok: true };
  });

  // ── Consume reset token + set new password ───────────────────────────────
  fastify.post('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token:    { type: 'string', pattern: '^[0-9a-f]{64}$' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { token, password } = req.body;

    const rows = await query(
      `SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    );
    const row = rows[0];

    if (!row)                                   return reply.code(400).send({ error: 'Invalid reset link.' });
    if (row.used)                               return reply.code(400).send({ error: 'This reset link has already been used.' });
    if (new Date(row.expires_at) < new Date())  return reply.code(400).send({ error: 'Reset link has expired — please request a new one.' });

    const passwordHash = await hashPassword(password);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, row.user_id]);
    await query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [row.id]);

    return { ok: true };
  });
}
