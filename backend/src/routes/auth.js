/**
 * Auth routes
 *
 * POST /api/auth/register   — create account
 * POST /api/auth/login      — get access + refresh tokens
 * POST /api/auth/refresh    — rotate refresh token → new access token
 * POST /api/auth/logout     — revoke refresh token
 * GET  /api/auth/me         — current user info
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { checkExclusion, RGLimitError } from '../services/rg.js';
import { query, transaction } from '../db.js';

// ─── Password hashing (scrypt, no external dep) ───────────────────────────────

import { scrypt, scryptSync } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key  = await scryptAsync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, storedKey] = stored.split(':');
  const key = await scryptAsync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return timingSafeEqual(Buffer.from(storedKey, 'hex'), key);
}

// ─── Refresh token helpers ────────────────────────────────────────────────────

function generateRefreshToken() {
  return randomBytes(40).toString('hex');
}

function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const REFRESH_TTL_DAYS = 30;

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function authRoutes(fastify) {
  // ── Register ──────────────────────────────────────────────────────────────
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', maxLength: 254 },
          username: { type: 'string', minLength: 3, maxLength: 32, pattern: '^[a-zA-Z0-9_]+$' },
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { email, username, password } = req.body;
    const passwordHash = await hashPassword(password);

    let user;
    try {
      const rows = await query(
        `INSERT INTO users (email, username, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, username, created_at`,
        [email.toLowerCase(), username, passwordHash]
      );
      user = rows[0];
    } catch (err) {
      if (err.constraint === 'users_email_key') {
        return reply.code(409).send({ error: 'Email already registered' });
      }
      if (err.constraint === 'users_username_key') {
        return reply.code(409).send({ error: 'Username already taken' });
      }
      throw err;
    }

    const { accessToken, refreshToken } = await issueTokens(fastify, user);
    return reply.code(201).send({ user, accessToken, refreshToken });
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body;
    const rows = await query(
      `SELECT id, email, username, password_hash, is_banned, kyc_status
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = rows[0];
    // Always verify to prevent timing-based user enumeration
    const valid = user ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !valid) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    if (user.is_banned) {
      return reply.code(403).send({ error: 'Account suspended' });
    }

    // Self-exclusion check — blocks login if excluded
    try {
      await checkExclusion(user.id);
    } catch (err) {
      if (err instanceof RGLimitError) {
        return reply.code(403).send({ error: err.message, code: err.code });
      }
      throw err;
    }

    const { accessToken, refreshToken } = await issueTokens(fastify, user);
    return { user: { id: user.id, email: user.email, username: user.username }, accessToken, refreshToken };
  });

  // ── Refresh ───────────────────────────────────────────────────────────────
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { refreshToken } = req.body;
    const tokenHash = hashRefreshToken(refreshToken);

    const rows = await query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.email, u.username, u.is_banned
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    const rt = rows[0];
    if (!rt || rt.revoked || new Date(rt.expires_at) < new Date()) {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
    if (rt.is_banned) {
      return reply.code(403).send({ error: 'Account suspended' });
    }

    // Rotate: revoke old, issue new
    await query(
      `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
      [rt.id]
    );

    const user = { id: rt.user_id, email: rt.email, username: rt.username };
    const { accessToken, refreshToken: newRefresh } = await issueTokens(fastify, user);
    return { accessToken, refreshToken: newRefresh };
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  fastify.post('/logout', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, async (req) => {
    const tokenHash = hashRefreshToken(req.body.refreshToken);
    await query(
      `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
      [tokenHash]
    );
    return { ok: true };
  });

  // ── Change password ───────────────────────────────────────────────────────
  fastify.post('/change-password', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: { password: { type: 'string', minLength: 8, maxLength: 128 } },
        additionalProperties: false,
      },
    },
  }, async (req) => {
    const passwordHash = await hashPassword(req.body.password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    return { ok: true };
  });

  // ── Me ────────────────────────────────────────────────────────────────────
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    const rows = await query(
      `SELECT id, email, username, kyc_status, is_admin, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    return rows[0] ?? null;
  });
}

// ─── Shared token issuer ──────────────────────────────────────────────────────

async function issueTokens(fastify, user) {
  const accessToken = fastify.jwt.sign(
    { sub: user.id, email: user.email, username: user.username },
    { expiresIn: '15m' }
  );

  const refreshToken = generateRefreshToken();
  const tokenHash    = hashRefreshToken(refreshToken);
  const expiresAt    = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
}
