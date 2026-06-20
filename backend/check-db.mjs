import { query } from './src/db.js';
const wallets = await query('SELECT user_id, address, network, verified FROM wallet_addresses');
console.log('wallet_addresses:', JSON.stringify(wallets, null, 2));
const deposits = await query('SELECT * FROM onchain_deposits ORDER BY created_at DESC LIMIT 5');
console.log('onchain_deposits:', JSON.stringify(deposits, null, 2));
process.exit(0);
