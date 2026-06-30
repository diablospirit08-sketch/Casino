/**
 * HD wallet address derivation for deposit addresses.
 *
 * All EVM currencies (ETH, USDC, BNB, USDT) share the BIP44 coin type 60
 * path, so the same derived address works on mainnet, BSC, and Polygon.
 * Alchemy is registered separately per network via webhooks.
 *
 * BTC and Tron are not supported here — they need different key paths and
 * address formats, and different monitoring infrastructure.
 */

import { HDNodeWallet, Mnemonic } from 'ethers';
import { query } from '../db.js';

export const EVM_CURRENCIES = new Set(['ETH', 'USDC', 'BNB', 'USDT']);

// Maps currency → env var holding the Alchemy webhook ID to register the address with
const ALCHEMY_WEBHOOK_ENV = {
  ETH:  'ALCHEMY_WEBHOOK_ID_ETH',
  USDC: 'ALCHEMY_WEBHOOK_ID_ETH',
  USDT: 'ALCHEMY_WEBHOOK_ID_ETH',
  BNB:  'ALCHEMY_WEBHOOK_ID_BNB',
};

function deriveEvmAddress(index) {
  const phrase = process.env.MASTER_MNEMONIC;
  if (!phrase) throw new Error('MASTER_MNEMONIC is not set');
  const mnemonic = Mnemonic.fromPhrase(phrase);
  return HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`).address;
}

async function registerWithAlchemy(address, currency) {
  const authToken = process.env.ALCHEMY_AUTH_TOKEN;
  const webhookId = process.env[ALCHEMY_WEBHOOK_ENV[currency]];
  if (!authToken || !webhookId) return;
  try {
    const res = await fetch('https://dashboard.alchemy.com/api/update-webhook-addresses', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': authToken,
      },
      body: JSON.stringify({
        webhook_id: webhookId,
        addresses_to_add: [address],
        addresses_to_remove: [],
      }),
    });
    if (!res.ok) {
      console.error('[hdwallet] Alchemy registration failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[hdwallet] Alchemy registration error:', err.message);
  }
}

/**
 * Return a real HD-derived deposit address for userId+currency.
 * Atomically claims the next index via DB advisory lock, derives the address,
 * updates the DB row, and registers the address with the Alchemy webhook.
 */
export async function generateDepositAddress(userId, currency) {
  if (!EVM_CURRENCIES.has(currency)) {
    throw new Error(`HD address generation not supported for ${currency} — requires separate infrastructure`);
  }

  // Atomically claim the next HD index. The DB function uses pg_advisory_xact_lock
  // so concurrent calls for the same currency are serialized.
  const rows = await query(
    `SELECT public.claim_deposit_address_slot($1, $2) AS idx`,
    [userId, currency]
  );
  const index = rows[0].idx;

  const address = deriveEvmAddress(index);

  // Update the placeholder row the RPC created with the real address
  await query(
    `UPDATE deposit_addresses SET address = $1
     WHERE user_id = $2 AND currency = $3 AND address_index = $4`,
    [address, userId, currency, index]
  );

  // Best-effort: tell Alchemy to watch this address
  await registerWithAlchemy(address, currency);

  return address;
}
