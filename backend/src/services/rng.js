/**
 * Provably Fair RNG
 *
 * How it works:
 *  1. Before a bet, the server generates a random server_seed and stores
 *     only its SHA-256 hash (server_seed_hash). The player sees the hash
 *     but not the seed, so the server can't change it after the fact.
 *  2. The player optionally provides a client_seed and a nonce (auto-
 *     incremented per bet).
 *  3. Result = HMAC-SHA256(server_seed, client_seed + ':' + nonce),
 *     converted to a float in [0, 1).
 *  4. After settlement the server reveals server_seed.
 *     Anyone can verify: hash(server_seed) === server_seed_hash, and
 *     re-derive the result with the same formula.
 *
 * Verification endpoint: POST /api/verify  { server_seed, client_seed, nonce }
 */

import { createHash, createHmac, randomBytes } from 'crypto';

// ─── Seed management ──────────────────────────────────────────────────────────

/** Generate a new random server seed (32 bytes hex). */
export function generateServerSeed() {
  return randomBytes(32).toString('hex');
}

/** SHA-256 hash of a server seed — shown to the player before the bet. */
export function hashServerSeed(serverSeed) {
  return createHash('sha256').update(serverSeed).digest('hex');
}

/** Generate a default client seed if the player didn't provide one. */
export function generateClientSeed() {
  return randomBytes(8).toString('hex');
}

// ─── Result derivation ────────────────────────────────────────────────────────

/**
 * Derive a float in [0, 1) from the three provably-fair inputs.
 * Uses the first 4 bytes of HMAC-SHA256 output as a 32-bit integer.
 */
export function deriveFloat(serverSeed, clientSeed, nonce) {
  const hmac = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest();

  // Read first 4 bytes as big-endian uint32, divide by 2^32
  const int32 = hmac.readUInt32BE(0);
  return int32 / 0x100000000;
}

/**
 * Derive multiple independent floats from one seed triple.
 * Uses byte offsets (4 bytes each) within the 32-byte HMAC output.
 * Falls back to additional HMAC calls (nonce suffix) if count > 8.
 */
export function deriveFloats(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  const hmac = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest();

  for (let i = 0; i < count; i++) {
    if (i < 8) {
      floats.push(hmac.readUInt32BE(i * 4) / 0x100000000);
    } else {
      // Overflow: derive extra floats with extended nonce
      floats.push(deriveFloat(serverSeed, clientSeed, `${nonce}-${i}`));
    }
  }
  return floats;
}

// ─── Game-specific outcome derivation ────────────────────────────────────────

/**
 * Dice — returns a roll in [0, 100).
 */
export function rollDice(serverSeed, clientSeed, nonce) {
  return deriveFloat(serverSeed, clientSeed, nonce) * 100;
}

/**
 * Coinflip — returns 'heads' or 'tails'.
 */
export function flipCoin(serverSeed, clientSeed, nonce) {
  return deriveFloat(serverSeed, clientSeed, nonce) < 0.5 ? 'heads' : 'tails';
}

/**
 * Mines — returns an array of `mineCount` unique mine positions in a
 * grid of `gridSize` cells (0-indexed). Uses Fisher-Yates partial shuffle.
 */
export function placeMines(serverSeed, clientSeed, nonce, gridSize, mineCount) {
  const positions = Array.from({ length: gridSize }, (_, i) => i);
  const floats = deriveFloats(serverSeed, clientSeed, nonce, mineCount);

  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(floats[i] * (gridSize - i));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, mineCount).sort((a, b) => a - b);
}

/**
 * Keno — returns `drawCount` unique drawn numbers from [1, pool].
 */
export function drawKeno(serverSeed, clientSeed, nonce, pool, drawCount) {
  const nums = Array.from({ length: pool }, (_, i) => i + 1);
  const floats = deriveFloats(serverSeed, clientSeed, nonce, drawCount);

  for (let i = 0; i < drawCount; i++) {
    const j = i + Math.floor(floats[i] * (pool - i));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums.slice(0, drawCount).sort((a, b) => a - b);
}

/**
 * Crash — returns the crash multiplier.
 * Uses the industry-standard formula: E = 99 / (1 - H)
 * where H is the house edge fraction (default 1%).
 * Result is floored at 1.00x.
 */
export function crashMultiplier(serverSeed, clientSeed, nonce, houseEdge = 0.01) {
  const f = deriveFloat(serverSeed, clientSeed, nonce);
  if (f < houseEdge) return 1.00;  // instant crash (house edge)
  return Math.max(1.00, (1 - houseEdge) / (1 - f));
}

/**
 * Plinko — simulates a ball dropping through `rows` rows of pegs.
 * Each peg deflects left (0) or right (1) based on successive floats.
 * Returns the final bucket index (0 to rows).
 */
export function plinkoPath(serverSeed, clientSeed, nonce, rows) {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, rows);
  let pos = 0;
  for (const f of floats) {
    pos += f < 0.5 ? 0 : 1;
  }
  return pos;
}

/**
 * Blackjack — returns a shuffled deck (0–51) using Fisher-Yates.
 * Cards: index % 13 = rank (0=Ace…12=King), Math.floor(index/13) = suit.
 */
export function shuffleDeck(serverSeed, clientSeed, nonce) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  // 51 swaps needed; derive 51 floats
  const floats = deriveFloats(serverSeed, clientSeed, nonce, 51);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(floats[51 - i] * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Roulette — returns a pocket number 0–36.
 */
export function spinRoulette(serverSeed, clientSeed, nonce) {
  return Math.floor(deriveFloat(serverSeed, clientSeed, nonce) * 37);
}

// ─── Verification helper ─────────────────────────────────────────────────────

/**
 * Verify a server seed matches its pre-committed hash.
 * Call this from the /api/verify endpoint.
 */
export function verifyServerSeed(serverSeed, serverSeedHash) {
  return hashServerSeed(serverSeed) === serverSeedHash;
}
