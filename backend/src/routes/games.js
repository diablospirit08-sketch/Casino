/**
 * Game-specific routes
 *
 * POST /api/games/blackjack/deal  — get a server-committed shuffled deck
 */

import { query } from '../db.js';
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  shuffleDeck,
} from '../services/rng.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function deckIndexToCard(i) {
  const r = RANKS[i % 13];
  return {
    r,
    s: SUITS[Math.floor(i / 13)],
    v: r === 'A' ? 11 : ['J', 'Q', 'K', '10'].includes(r) ? 10 : +r,
  };
}

export async function gamesRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * Blackjack deal — generate a server-committed shuffled deck.
   * Returns all 52 card objects so the client can play locally.
   * On settlement (/api/bets/place) the server re-derives the same deck
   * from the stored server_seed and verifies the outcome.
   */
  fastify.post('/blackjack/deal', async (req) => {
    const serverSeed     = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed     = generateClientSeed();
    const nonce          = 0;

    // Store the server seed the same way /api/bets/prepare does
    await query(
      `INSERT INTO bets
         (user_id, game, currency, wager, server_seed_hash, client_seed, nonce, result)
       VALUES ($1, 'pending', 'BNB', 0.00000001, $2, $3, 0,
               jsonb_build_object('_server_seed', $4::text))
       ON CONFLICT DO NOTHING`,
      [req.user.id, serverSeedHash, clientSeed, serverSeed],
    );

    const cards = shuffleDeck(serverSeed, clientSeed, nonce).map(deckIndexToCard);

    return { cards, serverSeedHash, clientSeed, nonce };
  });
}
