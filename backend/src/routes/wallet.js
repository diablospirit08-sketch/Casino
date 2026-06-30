/**
 * Wallet routes
 *
 * GET  /api/wallet/balances              — all balances for authed user
 * GET  /api/wallet/balance/:currency     — single currency balance
 * GET  /api/wallet/deposit-address/:currency/:network — get/create deposit address
 * GET  /api/wallet/history               — paginated ledger history
 * POST /api/wallet/connect-wallet        — link on-chain wallet address to account
 * GET  /api/wallet/connected-wallets     — list connected wallets
 * POST /api/wallet/sign-withdrawal       — get EIP-712 voucher for on-chain withdrawal
 * POST /api/wallet/withdraw              — request a withdrawal (off-chain record)
 * GET  /api/wallet/withdrawals           — withdrawal history
 */

import { verifyMessage, getAddress, parseEther } from 'ethers';
import { query, transaction } from '../db.js';
import { signWithdrawal, cashierAddress } from '../services/vault.js';
import { generateDepositAddress, EVM_CURRENCIES } from '../services/hdwallet.js';
import {
  getBalance,
  getAllBalances,
  getLedgerHistory,
  debitWithdrawal,
  InsufficientFundsError,
} from '../services/ledger.js';

// Supported currencies — minWithdraw, maxWithdraw (per tx), dailyCap (per user per day)
const CURRENCIES = {
  BTC:  { networks: ['mainnet'],                   minWithdraw: 0.0001, fee: 0.00005, maxWithdraw: 0.5,   dailyCap: 1.0    },
  ETH:  { networks: ['mainnet'],                   minWithdraw: 0.005,  fee: 0.002,   maxWithdraw: 5,     dailyCap: 10     },
  USDC: { networks: ['mainnet', 'bsc', 'polygon'], minWithdraw: 10,     fee: 1,       maxWithdraw: 5000,  dailyCap: 10000  },
  BNB:  { networks: ['bsc'],                       minWithdraw: 0.01,   fee: 0.001,   maxWithdraw: 50,    dailyCap: 100    },
  USDT: { networks: ['mainnet', 'bsc', 'tron'],    minWithdraw: 10,     fee: 1,       maxWithdraw: 5000,  dailyCap: 10000  },
};

// USD-equivalent threshold above which admin gets alerted
const ALERT_THRESHOLD = parseFloat(process.env.WITHDRAWAL_ALERT_THRESHOLD ?? '500');

// Rough USD rates for alert threshold comparison (not used for accounting)
const USD_RATES = { BTC: 65000, ETH: 3500, BNB: 600, USDT: 1, USDC: 1 };

async function getDailyWithdrawn(userId, currency) {
  const rows = await query(
    `SELECT COALESCE(SUM(amount), 0)::NUMERIC AS total
     FROM withdrawals
     WHERE user_id = $1 AND currency = $2
       AND status NOT IN ('failed','cancelled')
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')`,
    [userId, currency]
  );
  return parseFloat(rows[0].total);
}

async function alertAdmin(payload) {
  const url = process.env.ADMIN_WEBHOOK_URL;
  if (!url) return;
  const { username, userId, currency, amount, address, withdrawalId } = payload;
  const usd = (amount * (USD_RATES[currency] ?? 1)).toFixed(0);
  const msg = `🚨 **Large withdrawal queued**\n` +
    `User: **${username}** (\`${userId}\`)\n` +
    `Amount: **${amount} ${currency}** (~$${usd} USD)\n` +
    `Address: \`${address}\`\n` +
    `ID: \`${withdrawalId}\``;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch { /* non-critical */ }
}

export async function walletRoutes(fastify) {
  // All wallet routes require auth
  fastify.addHook('onRequest', fastify.authenticate);

  // ── All balances ───────────────────────────────────────────────────────────
  fastify.get('/balances', async (req) => {
    const rows = await getAllBalances(req.user.id);
    // Return a map { BTC: "0.00120000", USDC: "150.00000000" }
    const balances = {};
    for (const row of rows) {
      balances[row.currency] = parseFloat(row.balance).toFixed(8);
    }
    // Fill in zero for supported currencies not in ledger
    for (const c of Object.keys(CURRENCIES)) {
      if (!(c in balances)) balances[c] = '0.00000000';
    }
    return balances;
  });

  // ── Single balance ─────────────────────────────────────────────────────────
  fastify.get('/balance/:currency', {
    schema: {
      params: {
        type: 'object',
        properties: { currency: { type: 'string', enum: Object.keys(CURRENCIES) } },
        required: ['currency'],
      },
    },
  }, async (req) => {
    const balance = await getBalance(req.user.id, req.params.currency);
    return { currency: req.params.currency, balance: balance.toFixed(8) };
  });

  // ── Deposit address ────────────────────────────────────────────────────────
  fastify.get('/deposit-address/:currency/:network', {
    schema: {
      params: {
        type: 'object',
        required: ['currency', 'network'],
        properties: {
          currency: { type: 'string', enum: Object.keys(CURRENCIES) },
          network:  { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { currency, network } = req.params;
    const def = CURRENCIES[currency];
    if (!def.networks.includes(network)) {
      return reply.code(400).send({
        error: `${currency} is not supported on network ${network}. Supported: ${def.networks.join(', ')}`,
      });
    }

    if (!EVM_CURRENCIES.has(currency)) {
      return reply.code(400).send({ error: `${currency} deposits are not yet supported` });
    }

    // Return existing address if already generated (one per user per currency)
    const existing = await query(
      `SELECT address FROM deposit_addresses WHERE user_id = $1 AND currency = $2 AND address != ''`,
      [req.user.id, currency]
    );

    if (existing.length) {
      return { currency, network, address: existing[0].address };
    }

    const address = await generateDepositAddress(req.user.id, currency);
    return { currency, network, address };
  });

  // ── Ledger history ─────────────────────────────────────────────────────────
  fastify.get('/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          currency: { type: 'string' },
          limit:    { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset:   { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req) => {
    const { currency, limit, offset } = req.query;
    const rows = await getLedgerHistory(req.user.id, { currency, limit, offset });
    return { entries: rows, limit, offset };
  });

  // ── Withdraw ───────────────────────────────────────────────────────────────
  fastify.post('/withdraw', {
    schema: {
      body: {
        type: 'object',
        required: ['currency', 'network', 'amount', 'address'],
        properties: {
          currency: { type: 'string', enum: Object.keys(CURRENCIES) },
          network:  { type: 'string' },
          amount:   { type: 'number', exclusiveMinimum: 0 },
          address:  { type: 'string', minLength: 10, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { currency, network, amount, address } = req.body;
    const def = CURRENCIES[currency];

    if (!def.networks.includes(network)) {
      return reply.code(400).send({ error: `${currency} not supported on ${network}` });
    }
    if (amount < def.minWithdraw) {
      return reply.code(400).send({ error: `Minimum withdrawal for ${currency} is ${def.minWithdraw}` });
    }
    if (amount > def.maxWithdraw) {
      return reply.code(400).send({ error: `Maximum withdrawal per transaction for ${currency} is ${def.maxWithdraw}` });
    }

    // Daily cap check
    const dailyTotal = await getDailyWithdrawn(req.user.id, currency);
    if (dailyTotal + amount > def.dailyCap) {
      const remaining = Math.max(0, def.dailyCap - dailyTotal);
      return reply.code(400).send({
        error: `Daily withdrawal limit reached for ${currency}. Remaining today: ${remaining.toFixed(8)}`,
      });
    }

    // Create withdrawal record first (for the ledger ref_id)
    const wRows = await query(
      `INSERT INTO withdrawals (user_id, currency, network, amount, fee, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.user.id, currency, network, amount, def.fee, address]
    );
    const withdrawalId = wRows[0].id;

    try {
      const { balanceAfter } = await debitWithdrawal({
        userId: req.user.id,
        currency,
        amount,
        withdrawalId,
        address,
        network,
        fee: def.fee,
      });

      await query(
        `UPDATE withdrawals SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [withdrawalId]
      );

      // Alert admin if withdrawal exceeds threshold
      const usdValue = amount * (USD_RATES[currency] ?? 1);
      if (usdValue >= ALERT_THRESHOLD) {
        const userRows = await query(`SELECT username FROM users WHERE id = $1`, [req.user.id]);
        alertAdmin({
          username: userRows[0]?.username ?? req.user.id,
          userId: req.user.id,
          currency,
          amount,
          address,
          withdrawalId,
        });
      }

      return {
        withdrawalId,
        status: 'processing',
        currency,
        amount,
        fee: def.fee,
        netAmount: (amount - def.fee).toFixed(8),
        balanceAfter: balanceAfter.toFixed(8),
      };
    } catch (err) {
      // Rollback the withdrawal record if debit fails
      await query(
        `UPDATE withdrawals SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [withdrawalId]
      );
      if (err instanceof InsufficientFundsError) {
        return reply.code(402).send({ error: err.message });
      }
      throw err;
    }
  });

  // ── Withdrawal history ─────────────────────────────────────────────────────
  fastify.get('/withdrawals', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req) => {
    const { limit, offset } = req.query;
    const rows = await query(
      `SELECT id, currency, network, amount, fee, address, tx_hash, status, created_at, updated_at
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return { withdrawals: rows, limit, offset };
  });

  // ── Connect wallet ─────────────────────────────────────────────────────────
  // User proves ownership of their BSC wallet by signing a message with MetaMask.
  // The signed message links their wallet to their casino account.
  fastify.post('/connect-wallet', {
    schema: {
      body: {
        type: 'object',
        required: ['address', 'network', 'signature'],
        properties: {
          address:   { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
          network:   { type: 'string', enum: ['bsc', 'bsc_testnet'] },
          signature: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { address, network, signature } = req.body;

    // The message the frontend asked the user to sign
    const message = connectWalletMessage(req.user.id, address);

    // Verify the signature recovers to the claimed address
    let recovered;
    try {
      recovered = verifyMessage(message, signature);
    } catch {
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    if (getAddress(recovered) !== getAddress(address)) {
      return reply.code(400).send({ error: 'Signature does not match address' });
    }

    await query(
      `INSERT INTO wallet_addresses (user_id, address, network, verified)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (address, network) DO UPDATE SET user_id = $1, verified = true`,
      [req.user.id, address.toLowerCase(), network]
    );

    return { ok: true, address, network };
  });

  // ── Connect wallet message (frontend calls this to know what to sign) ───────
  fastify.get('/connect-wallet-message', {
    schema: {
      querystring: {
        type: 'object',
        required: ['address'],
        properties: { address: { type: 'string' } },
      },
    },
  }, async (req) => {
    const message = connectWalletMessage(req.user.id, req.query.address);
    return { message };
  });

  // ── Connected wallets ──────────────────────────────────────────────────────
  fastify.get('/connected-wallets', async (req) => {
    const rows = await query(
      `SELECT address, network, verified, created_at
       FROM wallet_addresses WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return { wallets: rows };
  });

  // ── Sign withdrawal voucher (EIP-712) ──────────────────────────────────────
  // Frontend calls this, gets a signature, then calls VoltVault.withdraw() on-chain.
  fastify.post('/sign-withdrawal', {
    schema: {
      body: {
        type: 'object',
        required: ['amountBnb', 'playerAddress', 'network'],
        properties: {
          amountBnb:     { type: 'number', exclusiveMinimum: 0 },
          playerAddress: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
          network:       { type: 'string', enum: ['bsc', 'bsc_testnet'] },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { amountBnb, playerAddress, network } = req.body;

    // Verify the wallet address belongs to this user
    const walletRows = await query(
      `SELECT id FROM wallet_addresses
       WHERE user_id = $1 AND address = $2 AND network = $3 AND verified = true`,
      [req.user.id, playerAddress.toLowerCase(), network]
    );
    if (!walletRows.length) {
      return reply.code(400).send({ error: 'Wallet address not connected to your account' });
    }

    // Get and increment nonce atomically — RETURNING avoids a separate SELECT race
    const nonceRows = await query(
      `INSERT INTO withdrawal_nonces (user_id, network, nonce)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, network) DO UPDATE SET nonce = withdrawal_nonces.nonce + 1
       RETURNING nonce`,
      [req.user.id, network]
    );
    const nonce = nonceRows[0].nonce;

    // Debit the ledger before signing — if debit fails the voucher is never issued
    // parseEther handles decimal precision correctly; Math.round(x * 1e18) loses precision
    const amountWei = parseEther(amountBnb.toFixed(18)).toString();
    const wRows = await query(
      `INSERT INTO withdrawals (user_id, currency, network, amount, fee, address)
       VALUES ($1,'BNB',$2,$3,0,$4) RETURNING id`,
      [req.user.id, network, amountBnb, playerAddress]
    );
    const withdrawalId = wRows[0].id;

    try {
      await debitWithdrawal({
        userId: req.user.id,
        currency: 'BNB',
        amount: amountBnb,
        withdrawalId,
        address: playerAddress,
        network,
        fee: 0,
      });
    } catch (err) {
      await query(`UPDATE withdrawals SET status='failed' WHERE id=$1`, [withdrawalId]);
      if (err instanceof InsufficientFundsError) {
        return reply.code(402).send({ error: err.message });
      }
      throw err;
    }

    // Voucher valid for 30 minutes
    const deadline = Math.floor(Date.now() / 1000) + 30 * 60;

    const signature = await signWithdrawal({
      player: playerAddress,
      amountWei,
      nonce,
      deadline,
      network,
    });

    await query(
      `UPDATE withdrawals SET status='processing', updated_at=NOW() WHERE id=$1`,
      [withdrawalId]
    );

    return {
      vaultAddress: process.env.VAULT_CONTRACT_ADDRESS,
      player:       playerAddress,
      amountWei,
      nonce,
      deadline,
      signature,
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function connectWalletMessage(userId, address) {
  return `Connect wallet to Volt Casino\n\nAccount: ${userId}\nAddress: ${address}\n\nThis signature proves you own this wallet. No funds will be moved.`;
}

