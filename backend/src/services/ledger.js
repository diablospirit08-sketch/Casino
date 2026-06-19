/**
 * Core ledger service.
 *
 * Rules:
 *  - Never update or delete ledger rows. Append only.
 *  - Never store a balance column. Derive it from SUM(amount).
 *  - Every balance check + debit must happen inside a single transaction
 *    with a row-level lock (FOR UPDATE) so concurrent bets can't
 *    double-spend the same balance.
 */
import { transaction, query } from '../db.js';

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Return the current balance for one user+currency.
 * Safe to call outside a transaction for display purposes.
 */
export async function getBalance(userId, currency) {
  const rows = await query(
    `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS balance
     FROM ledger
     WHERE user_id = $1 AND currency = $2`,
    [userId, currency]
  );
  return parseFloat(rows[0].balance);
}

/**
 * Return all non-zero balances for a user.
 */
export async function getAllBalances(userId) {
  return query(
    `SELECT currency, SUM(amount)::NUMERIC AS balance
     FROM ledger
     WHERE user_id = $1
     GROUP BY currency
     HAVING SUM(amount) != 0
     ORDER BY currency`,
    [userId]
  );
}

/**
 * Return ledger entries for a user (paginated).
 */
export async function getLedgerHistory(userId, { limit = 50, offset = 0, currency } = {}) {
  const params = [userId, limit, offset];
  const currencyClause = currency ? `AND currency = $${params.push(currency)}` : '';
  return query(
    `SELECT id, type, currency, amount, ref_id, meta, created_at
     FROM ledger
     WHERE user_id = $1 ${currencyClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );
}

// ─── Write (all mutations use transactions) ───────────────────────────────────

/**
 * Credit a user (deposit, payout, bonus, etc.).
 * Returns the new ledger row id.
 */
export async function credit(tx, { userId, type, currency, amount, refId, meta = {} }) {
  if (amount <= 0) throw new Error('credit amount must be positive');
  const rows = await tx.query(
    `INSERT INTO ledger (user_id, type, currency, amount, ref_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, type, currency, amount, refId ?? null, meta]
  );
  return rows.rows[0].id;
}

/**
 * Debit a user with balance check (bet, withdrawal).
 * Acquires a row-level lock on the user's ledger rows for the currency
 * so no concurrent transaction can read a stale balance.
 *
 * Throws if balance is insufficient.
 * Returns { ledgerId, balanceBefore, balanceAfter }.
 */
export async function debit(tx, { userId, type, currency, amount, refId, meta = {} }) {
  if (amount <= 0) throw new Error('debit amount must be positive');

  // Lock all ledger rows for this user+currency so no concurrent
  // debit can run until this transaction commits or rolls back.
  const balRow = await tx.query(
    `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS balance
     FROM ledger
     WHERE user_id = $1 AND currency = $2
     FOR UPDATE`,
    [userId, currency]
  );
  const balanceBefore = parseFloat(balRow.rows[0].balance);

  if (balanceBefore < amount) {
    throw new InsufficientFundsError(
      `Insufficient ${currency} balance: have ${balanceBefore}, need ${amount}`
    );
  }

  const ins = await tx.query(
    `INSERT INTO ledger (user_id, type, currency, amount, ref_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, type, currency, -amount, refId ?? null, meta]
  );

  return {
    ledgerId: ins.rows[0].id,
    balanceBefore,
    balanceAfter: balanceBefore - amount,
  };
}

// ─── Compound operations ─────────────────────────────────────────────────────

/**
 * Credit a confirmed deposit.
 * Idempotent: if txHash already credited, returns existing ledger row.
 */
export async function creditDeposit({ userId, currency, amount, txHash, network }) {
  return transaction(async (tx) => {
    // Idempotency guard — prevent double-crediting the same on-chain tx
    const existing = await tx.query(
      `SELECT credit_ledger_id FROM deposits WHERE tx_hash = $1 AND status = 'credited'`,
      [txHash]
    );
    if (existing.rows.length) return existing.rows[0].credit_ledger_id;

    const ledgerId = await credit(tx, {
      userId,
      type: 'deposit',
      currency,
      amount,
      refId: txHash,
      meta: { network },
    });

    await tx.query(
      `UPDATE deposits
       SET status = 'credited', credit_ledger_id = $1, updated_at = NOW()
       WHERE tx_hash = $2`,
      [ledgerId, txHash]
    );

    return ledgerId;
  });
}

/**
 * Debit a bet wager.
 * Returns { betId, debitLedgerId }.
 */
export async function debitBet(tx, { userId, currency, wager, betId, game }) {
  const { ledgerId } = await debit(tx, {
    userId,
    type: 'bet_debit',
    currency,
    amount: wager,
    refId: betId,
    meta: { game },
  });
  return ledgerId;
}

/**
 * Credit a bet payout (win).
 * Returns the credit ledger row id.
 */
export async function creditBet(tx, { userId, currency, payout, betId, game }) {
  return credit(tx, {
    userId,
    type: 'bet_credit',
    currency,
    amount: payout,
    refId: betId,
    meta: { game },
  });
}

/**
 * Debit a withdrawal request.
 * Returns { ledgerId, balanceAfter }.
 */
export async function debitWithdrawal({ userId, currency, amount, withdrawalId, address, network, fee }) {
  return transaction(async (tx) => {
    const result = await debit(tx, {
      userId,
      type: 'withdrawal',
      currency,
      amount,
      refId: withdrawalId,
      meta: { address, network },
    });

    if (fee > 0) {
      await debit(tx, {
        userId,
        type: 'withdrawal_fee',
        currency,
        amount: fee,
        refId: withdrawalId,
        meta: { address, network },
      });
    }

    await tx.query(
      `UPDATE withdrawals SET debit_ledger_id = $1, updated_at = NOW() WHERE id = $2`,
      [result.ledgerId, withdrawalId]
    );

    return result;
  });
}

// ─── Error types ─────────────────────────────────────────────────────────────

export class InsufficientFundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InsufficientFundsError';
    this.statusCode = 402;
  }
}
