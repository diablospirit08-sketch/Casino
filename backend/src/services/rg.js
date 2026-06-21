/**
 * Responsible Gambling enforcement service.
 *
 * All limits are stored as raw crypto amounts and enforced per currency.
 * e.g. rg_wager_daily = 0.1 means the player cannot wager more than 0.1 BNB
 * in a single day, AND not more than 0.1 ETH, etc. — applied independently.
 *
 * Windows are calendar-aligned UTC (resets at 00:00 UTC each day/week/month).
 */

import { query } from '../db.js';

export class RGLimitError extends Error {
  constructor(message, code = 'RG_LIMIT') {
    super(message);
    this.name = 'RGLimitError';
    this.statusCode = 403;
    this.code = code;
  }
}

// ─── Exclusion ────────────────────────────────────────────────────────────────

export async function checkExclusion(userId) {
  const rows = await query(
    `SELECT rg_excluded_permanent, rg_excluded_until FROM users WHERE id = $1`,
    [userId]
  );
  const u = rows[0];
  if (!u) return;

  if (u.rg_excluded_permanent) {
    throw new RGLimitError('Your account is permanently self-excluded.', 'SELF_EXCLUDED');
  }
  if (u.rg_excluded_until && new Date(u.rg_excluded_until) > new Date()) {
    const until = new Date(u.rg_excluded_until).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    throw new RGLimitError(`Your account is self-excluded until ${until}.`, 'SELF_EXCLUDED');
  }
}

// ─── Wager limits ─────────────────────────────────────────────────────────────

export async function checkWagerLimits(userId, currency, wager) {
  const rows = await query(
    `SELECT rg_wager_daily, rg_wager_weekly, rg_wager_monthly FROM users WHERE id = $1`,
    [userId]
  );
  const u = rows[0];
  if (!u || (u.rg_wager_daily == null && u.rg_wager_weekly == null && u.rg_wager_monthly == null)) return;

  async function sumWagered(since) {
    const r = await query(
      `SELECT COALESCE(-SUM(amount), 0) AS total
       FROM ledger
       WHERE user_id = $1 AND currency = $2 AND type = 'bet_debit' AND created_at >= $3`,
      [userId, currency, since]
    );
    return parseFloat(r[0].total);
  }

  if (u.rg_wager_daily != null) {
    const since = startOfDay();
    const spent = await sumWagered(since);
    if (spent + wager > parseFloat(u.rg_wager_daily)) {
      throw new RGLimitError(
        `Daily wager limit reached (${u.rg_wager_daily} ${currency}/day). Resets at midnight UTC.`
      );
    }
  }

  if (u.rg_wager_weekly != null) {
    const since = startOfWeek();
    const spent = await sumWagered(since);
    if (spent + wager > parseFloat(u.rg_wager_weekly)) {
      throw new RGLimitError(
        `Weekly wager limit reached (${u.rg_wager_weekly} ${currency}/week).`
      );
    }
  }

  if (u.rg_wager_monthly != null) {
    const since = startOfMonth();
    const spent = await sumWagered(since);
    if (spent + wager > parseFloat(u.rg_wager_monthly)) {
      throw new RGLimitError(
        `Monthly wager limit reached (${u.rg_wager_monthly} ${currency}/month).`
      );
    }
  }
}

// ─── Loss limits ──────────────────────────────────────────────────────────────

export async function checkLossLimits(userId, currency, wager) {
  const rows = await query(
    `SELECT rg_loss_daily, rg_loss_weekly, rg_loss_monthly FROM users WHERE id = $1`,
    [userId]
  );
  const u = rows[0];
  if (!u || (u.rg_loss_daily == null && u.rg_loss_weekly == null && u.rg_loss_monthly == null)) return;

  // Net loss = total wagered - total payouts received (floored at 0 if winning)
  async function sumNetLoss(since) {
    const r = await query(
      `SELECT
         COALESCE(-SUM(CASE WHEN type = 'bet_debit'  THEN amount ELSE 0 END), 0) AS wagered,
         COALESCE( SUM(CASE WHEN type = 'bet_credit' THEN amount ELSE 0 END), 0) AS paid_out
       FROM ledger
       WHERE user_id = $1 AND currency = $2
         AND type IN ('bet_debit', 'bet_credit') AND created_at >= $3`,
      [userId, currency, since]
    );
    return Math.max(0, parseFloat(r[0].wagered) - parseFloat(r[0].paid_out));
  }

  if (u.rg_loss_daily != null) {
    const since = startOfDay();
    const lost = await sumNetLoss(since);
    if (lost + wager > parseFloat(u.rg_loss_daily)) {
      throw new RGLimitError(
        `Daily loss limit reached (${u.rg_loss_daily} ${currency}/day). Resets at midnight UTC.`
      );
    }
  }

  if (u.rg_loss_weekly != null) {
    const since = startOfWeek();
    const lost = await sumNetLoss(since);
    if (lost + wager > parseFloat(u.rg_loss_weekly)) {
      throw new RGLimitError(
        `Weekly loss limit reached (${u.rg_loss_weekly} ${currency}/week).`
      );
    }
  }

  if (u.rg_loss_monthly != null) {
    const since = startOfMonth();
    const lost = await sumNetLoss(since);
    if (lost + wager > parseFloat(u.rg_loss_monthly)) {
      throw new RGLimitError(
        `Monthly loss limit reached (${u.rg_loss_monthly} ${currency}/month).`
      );
    }
  }
}

// ─── Deposit limits ───────────────────────────────────────────────────────────

export async function checkDepositLimits(userId, currency, amount) {
  const rows = await query(
    `SELECT rg_deposit_daily, rg_deposit_weekly, rg_deposit_monthly FROM users WHERE id = $1`,
    [userId]
  );
  const u = rows[0];
  if (!u || (u.rg_deposit_daily == null && u.rg_deposit_weekly == null && u.rg_deposit_monthly == null)) return;

  async function sumDeposited(since) {
    const r = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM ledger
       WHERE user_id = $1 AND currency = $2 AND type = 'deposit' AND created_at >= $3`,
      [userId, currency, since]
    );
    return parseFloat(r[0].total);
  }

  if (u.rg_deposit_daily != null) {
    const since = startOfDay();
    const deposited = await sumDeposited(since);
    if (deposited + amount > parseFloat(u.rg_deposit_daily)) {
      throw new RGLimitError(
        `Daily deposit limit reached (${u.rg_deposit_daily} ${currency}/day). Resets at midnight UTC.`
      );
    }
  }

  if (u.rg_deposit_weekly != null) {
    const since = startOfWeek();
    const deposited = await sumDeposited(since);
    if (deposited + amount > parseFloat(u.rg_deposit_weekly)) {
      throw new RGLimitError(
        `Weekly deposit limit reached (${u.rg_deposit_weekly} ${currency}/week).`
      );
    }
  }

  if (u.rg_deposit_monthly != null) {
    const since = startOfMonth();
    const deposited = await sumDeposited(since);
    if (deposited + amount > parseFloat(u.rg_deposit_monthly)) {
      throw new RGLimitError(
        `Monthly deposit limit reached (${u.rg_deposit_monthly} ${currency}/month).`
      );
    }
  }
}

// ─── Read current limits + today's usage ─────────────────────────────────────

export async function getLimits(userId, currency = 'BNB') {
  const userRows = await query(
    `SELECT rg_wager_daily, rg_wager_weekly, rg_wager_monthly,
            rg_loss_daily,  rg_loss_weekly,  rg_loss_monthly,
            rg_deposit_daily, rg_deposit_weekly, rg_deposit_monthly,
            rg_excluded_until, rg_excluded_permanent
     FROM users WHERE id = $1`,
    [userId]
  );
  const u = userRows[0] || {};

  // Today's usage
  const usageRows = await query(
    `SELECT
       COALESCE(-SUM(CASE WHEN type = 'bet_debit'  THEN amount ELSE 0 END), 0) AS wagered_today,
       COALESCE( SUM(CASE WHEN type = 'bet_credit' THEN amount ELSE 0 END), 0) AS paid_today,
       COALESCE( SUM(CASE WHEN type = 'deposit'    THEN amount ELSE 0 END), 0) AS deposited_today
     FROM ledger
     WHERE user_id = $1 AND currency = $2 AND created_at >= $3`,
    [userId, currency, startOfDay()]
  );
  const usage = usageRows[0] || {};
  const wageredToday  = parseFloat(usage.wagered_today)   || 0;
  const paidToday     = parseFloat(usage.paid_today)      || 0;
  const lostToday     = Math.max(0, wageredToday - paidToday);
  const depositedToday = parseFloat(usage.deposited_today) || 0;

  const excludedUntil = u.rg_excluded_permanent ? 'permanent'
    : u.rg_excluded_until ? u.rg_excluded_until
    : null;

  return {
    currency,
    wager:   { daily: u.rg_wager_daily,   weekly: u.rg_wager_weekly,   monthly: u.rg_wager_monthly },
    loss:    { daily: u.rg_loss_daily,    weekly: u.rg_loss_weekly,    monthly: u.rg_loss_monthly },
    deposit: { daily: u.rg_deposit_daily, weekly: u.rg_deposit_weekly, monthly: u.rg_deposit_monthly },
    usage:   { wageredToday, lostToday, depositedToday },
    excluded: excludedUntil,
  };
}

// ─── Calendar window helpers ──────────────────────────────────────────────────

function startOfDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
