/**
 * Bets routes
 *
 * POST /api/bets/prepare          — get server_seed_hash + client_seed for next bet
 * POST /api/bets/place            — place a bet (debit + derive result + settle)
 * GET  /api/bets/history          — paginated bet history
 * GET  /api/bets/:id              — single bet detail (includes server_seed after settlement)
 * POST /api/verify                — verify any past bet's provably fair result
 */

import { query, transaction } from '../db.js';
import { debitBet, creditBet, InsufficientFundsError } from '../services/ledger.js';
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  verifyServerSeed,
  rollDice,
  flipCoin,
  placeMines,
  drawKeno,
  crashMultiplier,
  plinkoPath,
  shuffleDeck,
  spinRoulette,
} from '../services/rng.js';

// ─── Game resolvers ───────────────────────────────────────────────────────────
// Each resolver receives { serverSeed, clientSeed, nonce, params }
// and returns { result, multiplier } where multiplier is the payout ratio
// (1.0 = break-even, 0 = total loss, 2.0 = 2× payout).

const GAMES = {
  'originals-dice': ({ serverSeed, clientSeed, nonce, params }) => {
    const { target, direction } = params; // target: 0–100, direction: 'over'|'under'
    const roll = rollDice(serverSeed, clientSeed, nonce);
    const win  = direction === 'over' ? roll > target : roll < target;
    const edge = 0.01;
    const chance = direction === 'over' ? (100 - target) / 100 : target / 100;
    const multiplier = win ? (1 - edge) / chance : 0;
    return { result: { roll: +roll.toFixed(2), target, direction, win }, multiplier };
  },

  'originals-coinflip': ({ serverSeed, clientSeed, nonce, params }) => {
    const { pick } = params; // 'heads' | 'tails'
    const side = flipCoin(serverSeed, clientSeed, nonce);
    const win  = side === pick;
    return { result: { side, pick, win }, multiplier: win ? 1.98 : 0 };
  },

  'originals-mines': ({ serverSeed, clientSeed, nonce, params }) => {
    // params: { mineCount, revealedCells } — array of cell indices the player uncovered
    const { mineCount = 3, revealedCells = [] } = params;
    const gridSize = 25;
    const mines = placeMines(serverSeed, clientSeed, nonce, gridSize, mineCount);
    const mineSet = new Set(mines);

    let hitMine = false;
    for (const cell of revealedCells) {
      if (mineSet.has(cell)) { hitMine = true; break; }
    }

    const safeCount = gridSize - mineCount;
    // Multiplier for k safe reveals: product of (safeCount - i) / (gridSize - i) for i in 0..k-1
    let multiplier = 0;
    if (!hitMine && revealedCells.length > 0) {
      let m = 1;
      for (let i = 0; i < revealedCells.length; i++) {
        m *= (gridSize - i) / (safeCount - i);
      }
      multiplier = +(m * 0.99).toFixed(4); // 1% house edge
    }
    return { result: { mines, revealedCells, hitMine }, multiplier };
  },

  'originals-keno': ({ serverSeed, clientSeed, nonce, params }) => {
    const { picks = [] } = params; // player's chosen numbers 1–40
    const drawn = drawKeno(serverSeed, clientSeed, nonce, 40, 10);
    const hits  = picks.filter(n => drawn.includes(n)).length;
    const multiplier = kenoMultiplier(picks.length, hits);
    return { result: { drawn, picks, hits }, multiplier };
  },

  'originals-crash': ({ serverSeed, clientSeed, nonce, params }) => {
    const { cashoutAt } = params; // float, e.g. 2.00
    const crash  = crashMultiplier(serverSeed, clientSeed, nonce);
    const win    = cashoutAt <= crash;
    const multiplier = win ? cashoutAt : 0;
    return { result: { crash: +crash.toFixed(2), cashoutAt, win }, multiplier };
  },

  'originals-plinko': ({ serverSeed, clientSeed, nonce, params }) => {
    const { rows = 16, risk = 'medium' } = params;
    const bucket     = plinkoPath(serverSeed, clientSeed, nonce, rows);
    const multiplier = plinkoMultiplier(rows, risk, bucket);
    return { result: { bucket, rows, risk }, multiplier };
  },

  'originals-blackjack': ({ serverSeed, clientSeed, nonce, params }) => {
    const { actions = [] } = params; // ['hit','hit','stand'] etc.
    const deck   = shuffleDeck(serverSeed, clientSeed, nonce);
    const outcome = resolveBlackjack(deck, actions);
    return { result: outcome, multiplier: outcome.multiplier };
  },

  'originals-roulette': ({ serverSeed, clientSeed, nonce, params }) => {
    const { bets: betList = [] } = params;
    // betList: [{ type: 'number', value: 7, amount: 1 }, ...]
    const pocket = spinRoulette(serverSeed, clientSeed, nonce);
    const totalWin = rouletteWin(pocket, betList);
    const totalBet = betList.reduce((s, b) => s + b.amount, 0) || 1;
    return { result: { pocket, bets: betList, totalWin }, multiplier: totalWin / totalBet };
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function betsRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ── Prepare (get seeds for next bet) ──────────────────────────────────────
  fastify.post('/prepare', async (req) => {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = generateClientSeed();

    // Store server seed temporarily keyed by hash so we can look it up at settle time.
    // In production use Redis with a TTL. Here: store in the DB as a placeholder bet.
    await query(
      `INSERT INTO bets (user_id, game, currency, wager, server_seed_hash, client_seed, nonce)
       VALUES ($1, 'pending', 'BTC', 0, $2, $3, 0)
       ON CONFLICT DO NOTHING`,
      [req.user.id, serverSeedHash, clientSeed]
    );

    // Persist encrypted server seed (in prod: encrypt with AES before storing)
    await query(
      `UPDATE bets SET result = jsonb_set(result, '{_server_seed}', $1::jsonb)
       WHERE server_seed_hash = $2 AND user_id = $3 AND status = 'pending' AND game = 'pending'`,
      [JSON.stringify(serverSeed), serverSeedHash, req.user.id]
    );

    return { serverSeedHash, clientSeed };
  });

  // ── Place bet ─────────────────────────────────────────────────────────────
  fastify.post('/place', {
    schema: {
      body: {
        type: 'object',
        required: ['game', 'currency', 'wager', 'serverSeedHash', 'clientSeed', 'nonce'],
        properties: {
          game:           { type: 'string' },
          currency:       { type: 'string' },
          wager:          { type: 'number', exclusiveMinimum: 0 },
          serverSeedHash: { type: 'string' },
          clientSeed:     { type: 'string', maxLength: 128 },
          nonce:          { type: 'integer', minimum: 0 },
          params:         { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { game, currency, wager, serverSeedHash, clientSeed, nonce, params = {} } = req.body;

    if (!GAMES[game]) {
      return reply.code(400).send({ error: `Unknown game: ${game}` });
    }

    // Retrieve the server seed we stored at /prepare time
    const seedRows = await query(
      `SELECT result->>'_server_seed' AS server_seed
       FROM bets
       WHERE server_seed_hash = $1 AND user_id = $2 AND status = 'pending' AND game = 'pending'`,
      [serverSeedHash, req.user.id]
    );

    if (!seedRows.length || !seedRows[0].server_seed) {
      return reply.code(400).send({ error: 'Unknown or expired serverSeedHash. Call /bets/prepare first.' });
    }

    const serverSeed = seedRows[0].server_seed;

    // Resolve game outcome
    const { result, multiplier } = GAMES[game]({ serverSeed, clientSeed, nonce, params });
    const payout = +(wager * multiplier).toFixed(8);

    try {
      const bet = await transaction(async (tx) => {
        // Create real bet record
        const betRows = await tx.query(
          `INSERT INTO bets
             (user_id, game, currency, wager, multiplier, payout,
              server_seed_hash, server_seed, client_seed, nonce, result, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id`,
          [
            req.user.id, game, currency, wager, multiplier, payout,
            serverSeedHash, serverSeed, clientSeed, nonce,
            result, multiplier > 0 ? 'won' : 'lost',
          ]
        );
        const betId = betRows.rows[0].id;

        // Debit wager
        const debitId = await debitBet(tx, { userId: req.user.id, currency, wager, betId, game });

        // Credit payout if won
        let creditId = null;
        if (payout > 0) {
          creditId = await creditBet(tx, { userId: req.user.id, currency, payout, betId, game });
        }

        // Link ledger rows to bet
        await tx.query(
          `UPDATE bets SET debit_ledger_id = $1, credit_ledger_id = $2, settled_at = NOW()
           WHERE id = $3`,
          [debitId, creditId, betId]
        );

        // Mark the prepare-placeholder as used
        await tx.query(
          `DELETE FROM bets WHERE server_seed_hash = $1 AND user_id = $2 AND game = 'pending'`,
          [serverSeedHash, req.user.id]
        );

        return { betId, debitId, creditId };
      });

      return {
        betId:          bet.betId,
        game,
        currency,
        wager,
        multiplier,
        payout,
        result,
        serverSeed,     // revealed immediately after settlement
        serverSeedHash,
        clientSeed,
        nonce,
      };
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        return reply.code(402).send({ error: err.message });
      }
      throw err;
    }
  });

  // ── History ────────────────────────────────────────────────────────────────
  fastify.get('/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          game:   { type: 'string' },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req) => {
    const { game, limit, offset } = req.query;
    const params = [req.user.id, limit, offset];
    const gameClause = game ? `AND game = $${params.push(game)}` : '';
    const rows = await query(
      `SELECT id, game, currency, wager, multiplier, payout, result, status,
              server_seed_hash, client_seed, nonce, created_at, settled_at
       FROM bets
       WHERE user_id = $1 AND game != 'pending' ${gameClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );
    return { bets: rows, limit, offset };
  });

  // ── Single bet ─────────────────────────────────────────────────────────────
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (req, reply) => {
    const rows = await query(
      `SELECT id, game, currency, wager, multiplier, payout, result, status,
              server_seed_hash, server_seed, client_seed, nonce, created_at, settled_at
       FROM bets WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Bet not found' });
    return rows[0];
  });
}

// ─── Verify endpoint (public) ─────────────────────────────────────────────────

export async function verifyRoutes(fastify) {
  fastify.post('/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['serverSeed', 'clientSeed', 'nonce', 'game'],
        properties: {
          serverSeed: { type: 'string' },
          clientSeed: { type: 'string' },
          nonce:      { type: 'integer' },
          game:       { type: 'string' },
          params:     { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { serverSeed, clientSeed, nonce, game, params = {} } = req.body;
    if (!GAMES[game]) {
      return reply.code(400).send({ error: `Unknown game: ${game}` });
    }

    const serverSeedHash = hashServerSeed(serverSeed);
    const { result, multiplier } = GAMES[game]({ serverSeed, clientSeed, nonce, params });

    return { serverSeedHash, serverSeed, clientSeed, nonce, game, result, multiplier };
  });
}

// ─── Game helpers ─────────────────────────────────────────────────────────────

function kenoMultiplier(picks, hits) {
  const table = {
    1:  [0, 3.8],
    2:  [0, 0, 6],
    3:  [0, 0, 2.5, 20],
    4:  [0, 0, 1.5, 5, 40],
    5:  [0, 0, 1, 3, 15, 100],
    6:  [0, 0, 1, 2, 8,  40, 200],
    7:  [0, 0, 0.5, 1, 4, 20, 100, 400],
    8:  [0, 0, 0.5, 1, 3, 10, 50, 200, 800],
    9:  [0, 0, 0.5, 1, 2, 5, 25, 100, 400, 1000],
    10: [0, 0, 0.5, 1, 2, 4, 15, 60, 200, 500, 2000],
  };
  const row = table[Math.min(picks, 10)] ?? [];
  return row[Math.min(hits, row.length - 1)] ?? 0;
}

function plinkoMultiplier(rows, risk, bucket) {
  const tables = {
    low:    { 8:  [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
               16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16] },
    medium: { 8:  [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
               16: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
    high:   { 8:  [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
               16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] },
  };
  const table = tables[risk]?.[rows] ?? tables.medium[16];
  return table[Math.min(bucket, table.length - 1)] ?? 0;
}

function resolveBlackjack(deck, actions) {
  const rankOf = c => Math.min(c % 13 + 1, 10);
  const isAce  = c => c % 13 === 0;

  function handValue(cards) {
    let sum = 0, aces = 0;
    for (const c of cards) { sum += rankOf(c); if (isAce(c)) aces++; }
    while (sum > 21 && aces > 0) { sum -= 10; aces--; }
    return sum;
  }

  let di = 0;
  const player = [deck[di++], deck[di++]];
  const dealer = [deck[di++], deck[di++]];

  for (const action of actions) {
    if (action === 'hit') { player.push(deck[di++]); if (handValue(player) > 21) break; }
    else break; // stand
  }

  // Dealer hits on soft 17
  while (handValue(dealer) < 17) dealer.push(deck[di++]);

  const pv = handValue(player);
  const dv = handValue(dealer);
  const bust = pv > 21;
  const dealerBust = dv > 21;
  const win = !bust && (dealerBust || pv > dv);
  const push = !bust && !dealerBust && pv === dv;

  const multiplier = bust ? 0 : push ? 1 : win ? 2 : 0;
  return { player, dealer, playerValue: pv, dealerValue: dv, bust, dealerBust, win, push, multiplier };
}

function rouletteWin(pocket, betList) {
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  let total = 0;
  for (const b of betList) {
    const { type, value, amount } = b;
    let payout = 0;
    if (type === 'number'  && pocket === value)                    payout = amount * 36;
    if (type === 'red'     && pocket !== 0 && RED.has(pocket))     payout = amount * 2;
    if (type === 'black'   && pocket !== 0 && !RED.has(pocket))    payout = amount * 2;
    if (type === 'even'    && pocket !== 0 && pocket % 2 === 0)    payout = amount * 2;
    if (type === 'odd'     && pocket !== 0 && pocket % 2 !== 0)    payout = amount * 2;
    if (type === 'low'     && pocket >= 1  && pocket <= 18)        payout = amount * 2;
    if (type === 'high'    && pocket >= 19 && pocket <= 36)        payout = amount * 2;
    if (type === 'dozen1'  && pocket >= 1  && pocket <= 12)        payout = amount * 3;
    if (type === 'dozen2'  && pocket >= 13 && pocket <= 24)        payout = amount * 3;
    if (type === 'dozen3'  && pocket >= 25 && pocket <= 36)        payout = amount * 3;
    total += payout;
  }
  return total;
}
