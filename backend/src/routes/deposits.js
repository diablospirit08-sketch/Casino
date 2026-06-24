/**
 * Deposit webhook routes
 *
 * POST /api/deposits/webhook   — Alchemy fires this on every Deposited event
 * GET  /api/deposits/history   — deposit history for authed user
 *
 * Alchemy setup (do this after VoltVault is deployed):
 *   1. Go to dashboard.alchemy.com → Webhooks → Create Webhook
 *   2. Choose "Custom Webhook (GraphQL)" for precise event filtering
 *   3. Select your BSC app
 *   4. Use this GraphQL query (replace VAULT_ADDRESS):
 *
 *      {
 *        block {
 *          logs(filter: {
 *            addresses: ["VAULT_ADDRESS"],
 *            topics: ["0x<DEPOSITED_TOPIC>"]
 *          }) {
 *            account { address }
 *            topics
 *            data
 *            transaction { hash }
 *            index
 *          }
 *        }
 *      }
 *
 *   5. Set webhook URL to: https://your-domain.com/api/deposits/webhook
 *   6. Copy the signing key → ALCHEMY_WEBHOOK_SECRET in .env
 *
 * Alternatively, use "Address Activity" webhook on the VoltVault address —
 * this handler supports both payload formats.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { JsonRpcProvider } from 'ethers';
import { query, transaction } from '../db.js';
import { creditDeposit } from '../services/ledger.js';
import { parseDepositedLog, weiBnb, DEPOSITED_TOPIC } from '../services/vault.js';
import { checkDepositLimits, RGLimitError } from '../services/rg.js';

const BSC_RPC = {
  bsc:         'https://bsc-dataseed.binance.org/',
  bsc_testnet: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
};

// Minimum deposit in BNB (~$1 at current prices)
const MIN_DEPOSIT_BNB = 0.002;

export async function depositRoutes(fastify) {
  // ── Alchemy webhook ─────────────────────────────────────────────────────────
  // No JWT auth — Alchemy calls this. Use HMAC signing instead.
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body;
    try { done(null, JSON.parse(body)); } catch (err) { done(err); }
  });

  fastify.post('/webhook', async (req, reply) => {
    // Verify Alchemy HMAC signature
    if (!verifyAlchemySignature(req)) {
      fastify.log.warn('Alchemy webhook: invalid signature');
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    const { type, event } = req.body ?? {};
    const logs = extractLogs(type, event);

    for (const log of logs) {
      await processLog(log, fastify.log);
    }

    return { ok: true, processed: logs.length };
  });

  // ── Verify tx hash directly (fallback when webhook doesn't fire) ───────────
  fastify.post('/verify-tx', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['txHash'],
        properties: {
          txHash:  { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
          network: { type: 'string', enum: ['bsc', 'bsc_testnet'], default: 'bsc_testnet' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { txHash, network = 'bsc_testnet' } = req.body;
    const rpcUrl = BSC_RPC[network];
    if (!rpcUrl) return reply.code(400).send({ error: 'Unknown network' });

    const provider = new JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return reply.code(404).send({ error: 'Transaction not found or not yet mined' });
    if (receipt.status !== 1) return reply.code(400).send({ error: 'Transaction failed on-chain' });

    const vaultAddr = (process.env.VAULT_CONTRACT_ADDRESS ?? '').toLowerCase();
    let credited = 0;

    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      if (log.address.toLowerCase() !== vaultAddr) continue;

      const parsed = parseDepositedLog({
        topics: log.topics,
        data:   log.data,
        transaction: { hash: txHash },
        index: i,
        blockNumber: Number(receipt.blockNumber),
      });
      if (!parsed) continue;

      const amountBnb = weiBnb(parsed.amountWei);
      if (amountBnb < MIN_DEPOSIT_BNB) continue;

      await creditOnchainDeposit({
        txHash,
        logIndex:      i,
        playerAddress: parsed.player,
        amountBnb,
        amountWei:     parsed.amountWei,
        blockNumber:   Number(receipt.blockNumber),
        network,
      }, fastify.log);
      credited++;
    }

    if (!credited) return reply.code(400).send({ error: 'No Deposited event found in this transaction' });
    const bal = await query(
      `SELECT COALESCE(SUM(amount),0) AS balance FROM ledger WHERE user_id=$1 AND currency='BNB'`,
      [req.user.id]
    );
    return { ok: true, credited, balance: parseFloat(bal[0].balance).toFixed(8) };
  });

  // ── Deposit history (authed) ────────────────────────────────────────────────
  fastify.get('/history', {
    onRequest: [fastify.authenticate],
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
      `SELECT id, network, tx_hash, player_address, amount_bnb, block_number, status, created_at
       FROM onchain_deposits WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return { deposits: rows, limit, offset };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function verifyAlchemySignature(req) {
  const secret = process.env.ALCHEMY_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured — allow (dev mode)

  const sig = req.headers['x-alchemy-signature'];
  if (!sig) return false;

  const expected = createHmac('sha256', secret)
    .update(req.rawBody ?? '')
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

/**
 * Extract EVM logs from either Alchemy webhook format:
 *   - type "GRAPHQL"         → event.data.block.logs
 *   - type "ADDRESS_ACTIVITY" → parse activity entries as synthetic log objects
 */
function extractLogs(type, event) {
  if (type === 'GRAPHQL') {
    return event?.data?.block?.logs ?? [];
  }

  if (type === 'ADDRESS_ACTIVITY') {
    // Address Activity gives us transfer summaries, not raw logs.
    // Filter for incoming BNB to the vault address and reconstruct a
    // minimal log object so parseDepositedLog can handle it.
    const vaultAddr = (process.env.VAULT_CONTRACT_ADDRESS ?? '').toLowerCase();
    const activities = event?.activity ?? [];
    return activities
      .filter(a => a.toAddress?.toLowerCase() === vaultAddr && a.asset === 'BNB')
      .map(a => ({
        _addressActivity: a, // flag for special handling below
        topics: null,        // will be fetched from tx receipt
      }));
  }

  return [];
}

async function processLog(log, logger) {
  try {
    // Address Activity: we only have transfer info, not the raw log.
    // We treat the fromAddress as the player and use value in BNB.
    if (log._addressActivity) {
      const a = log._addressActivity;
      await creditOnchainDeposit({
        txHash:        a.hash,
        logIndex:      0,
        playerAddress: a.fromAddress,
        amountBnb:     a.value,
        amountWei:     String(BigInt(Math.round(a.value * 1e18))),
        blockNumber:   parseInt(a.blockNum, 16),
        network:       alchemyNetworkToBsc(a.asset, a),
      }, logger);
      return;
    }

    // GraphQL Custom Webhook — raw log with topics
    const parsed = parseDepositedLog(log);
    if (!parsed) return;

    const amountBnb = weiBnb(parsed.amountWei);
    if (amountBnb < MIN_DEPOSIT_BNB) {
      logger.warn({ parsed }, 'Deposit below minimum — skipping');
      return;
    }

    await creditOnchainDeposit({
      txHash:        log.transaction?.hash ?? log.transactionHash,
      logIndex:      log.index ?? 0,
      playerAddress: parsed.player,
      amountBnb,
      amountWei:     parsed.amountWei,
      blockNumber:   log.blockNumber ?? 0,
      network:       networkFromEnv(),
    }, logger);
  } catch (err) {
    logger.error({ err, log }, 'Failed to process deposit log');
  }
}

async function creditOnchainDeposit({ txHash, logIndex, playerAddress, amountBnb, amountWei, blockNumber, network }, logger) {
  // Look up user by wallet address
  const walletRows = await query(
    `SELECT user_id FROM wallet_addresses WHERE address = $1 AND network = $2`,
    [playerAddress.toLowerCase(), network]
  );

  if (!walletRows.length) {
    logger.warn({ playerAddress, network }, 'Deposit from unknown wallet address — no matching user');
    return;
  }
  const userId = walletRows[0].user_id;

  // Idempotency: skip if already recorded
  const existing = await query(
    `SELECT id FROM onchain_deposits WHERE tx_hash = $1 AND log_index = $2`,
    [txHash, logIndex]
  );
  if (existing.length) {
    logger.info({ txHash, logIndex }, 'Deposit already processed — skipping');
    return;
  }

  // Enforce RG deposit limits — reject the deposit if a limit is exceeded
  try {
    await checkDepositLimits(userId, 'BNB', amountBnb);
  } catch (err) {
    if (err instanceof RGLimitError) {
      logger.warn({ userId, amountBnb, code: err.code }, 'Deposit blocked by RG limit');
      return; // silently skip — funds remain on-chain, player must contact support
    }
    throw err;
  }

  await transaction(async (tx) => {
    // Record the on-chain deposit
    const depRows = await tx.query(
      `INSERT INTO onchain_deposits
         (user_id, network, tx_hash, log_index, player_address, amount_wei, amount_bnb, block_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [userId, network, txHash, logIndex, playerAddress.toLowerCase(), amountWei, amountBnb, blockNumber]
    );
    const depositId = depRows.rows[0].id;

    // Credit the off-chain ledger
    const ledgerId = await creditDeposit({
      userId,
      currency: 'BNB',
      amount:   amountBnb,
      txHash,
      network,
    });

    // Link ledger row to deposit record
    await tx.query(
      `UPDATE onchain_deposits SET status = 'credited', credit_ledger_id = $1 WHERE id = $2`,
      [ledgerId, depositId]
    );
  });

  logger.info({ userId, playerAddress, amountBnb, txHash }, 'Deposit credited');
}

function networkFromEnv() {
  return process.env.BSC_NETWORK ?? 'bsc_testnet';
}

function alchemyNetworkToBsc(asset, activity) {
  const net = activity?.network ?? '';
  if (net.includes('MAINNET')) return 'bsc';
  return 'bsc_testnet';
}
