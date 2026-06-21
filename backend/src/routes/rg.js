/**
 * Responsible Gambling routes
 *
 * GET  /api/rg/limits          — get current limits + today's usage
 * PUT  /api/rg/limits          — set one or more limits
 * DELETE /api/rg/limits        — clear one or more limits
 * POST /api/rg/exclude         — self-exclude (immediate)
 * DELETE /api/rg/exclude       — request to lift exclusion (permanent: contact support; timed: if expired)
 */

import { query } from '../db.js';
import { getLimits, RGLimitError } from '../services/rg.js';

const VALID_LIMIT_KEYS = [
  'wager_daily', 'wager_weekly', 'wager_monthly',
  'loss_daily',  'loss_weekly',  'loss_monthly',
  'deposit_daily', 'deposit_weekly', 'deposit_monthly',
];

export async function rgRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Get limits + usage ───────────────────────────────────────────────────
  fastify.get('/limits', {
    schema: {
      querystring: {
        type: 'object',
        properties: { currency: { type: 'string' } },
      },
    },
  }, async (req) => {
    const currency = req.query.currency || 'BNB';
    return getLimits(req.user.id, currency);
  });

  // ── Set limits ───────────────────────────────────────────────────────────
  // Body: { wager_daily: 0.5, loss_daily: 0.3 }  (any subset of VALID_LIMIT_KEYS)
  fastify.put('/limits', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(
          VALID_LIMIT_KEYS.map(k => [k, { type: ['number', 'null'], minimum: 0 }])
        ),
      },
    },
  }, async (req, reply) => {
    const updates = req.body;
    if (!updates || !Object.keys(updates).length) {
      return reply.code(400).send({ error: 'No limits provided' });
    }

    // Build SET clause dynamically
    const setClauses = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (!VALID_LIMIT_KEYS.includes(key)) continue;
      const col = `rg_${key.replace('_', '_')}`; // wager_daily → rg_wager_daily
      setClauses.push(`rg_${key} = $${values.push(val === null ? null : Math.max(0, val))}`);
    }

    if (!setClauses.length) {
      return reply.code(400).send({ error: 'No valid limit keys provided' });
    }

    values.push(req.user.id);
    await query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );

    const currency = req.query?.currency || 'BNB';
    return getLimits(req.user.id, currency);
  });

  // ── Clear specific limits ────────────────────────────────────────────────
  fastify.delete('/limits', {
    schema: {
      body: {
        type: 'object',
        required: ['keys'],
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string', enum: VALID_LIMIT_KEYS },
            minItems: 1,
          },
        },
        additionalProperties: false,
      },
    },
  }, async (req) => {
    const { keys } = req.body;
    const setClauses = keys.map((k, i) => `rg_${k} = $${i + 1}`);
    const values = [...keys.map(() => null), req.user.id];
    await query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
      values
    );
    return getLimits(req.user.id, 'BNB');
  });

  // ── Self-exclude ─────────────────────────────────────────────────────────
  fastify.post('/exclude', {
    schema: {
      body: {
        type: 'object',
        required: ['period'],
        properties: {
          // period: hours (24, 168=1w, 720=1mo, 8760=1yr) or 'permanent'
          period: { oneOf: [{ type: 'number', minimum: 1 }, { type: 'string', const: 'permanent' }] },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { period } = req.body;
    const permanent = period === 'permanent';
    const excludedUntil = permanent ? null : new Date(Date.now() + period * 3600 * 1000);

    await query(
      `UPDATE users
       SET rg_excluded_permanent = $1, rg_excluded_until = $2, updated_at = NOW()
       WHERE id = $3`,
      [permanent, permanent ? null : excludedUntil, req.user.id]
    );

    // Revoke all refresh tokens so existing sessions are terminated
    await query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
      [req.user.id]
    );

    return {
      excluded: true,
      permanent,
      until: permanent ? null : excludedUntil.toISOString(),
      message: permanent
        ? 'Your account is permanently self-excluded. Contact support to appeal.'
        : `Self-exclusion active until ${excludedUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
    };
  });

  // ── Lift exclusion ───────────────────────────────────────────────────────
  fastify.delete('/exclude', async (req, reply) => {
    const rows = await query(
      `SELECT rg_excluded_permanent, rg_excluded_until FROM users WHERE id = $1`,
      [req.user.id]
    );
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: 'User not found' });

    if (u.rg_excluded_permanent) {
      return reply.code(403).send({
        error: 'Permanent self-exclusion cannot be lifted via the app. Please contact support.',
        code: 'PERMANENT_EXCLUSION',
      });
    }

    if (!u.rg_excluded_until || new Date(u.rg_excluded_until) <= new Date()) {
      // Already expired or not excluded — clear the field
      await query(
        `UPDATE users SET rg_excluded_until = NULL, updated_at = NOW() WHERE id = $1`,
        [req.user.id]
      );
      return { excluded: false };
    }

    // Timed exclusion still active
    return reply.code(403).send({
      error: `Your self-exclusion is active until ${new Date(u.rg_excluded_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. You cannot lift it early.`,
      code: 'EXCLUSION_ACTIVE',
      until: u.rg_excluded_until,
    });
  });
}
