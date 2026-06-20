import './src/db.js';
import { query } from './src/db.js';
const rows = await query(`SELECT user_id, server_seed_hash FROM bets WHERE game='pending' ORDER BY created_at DESC LIMIT 3`);
console.log('pending bets user_ids:', JSON.stringify(rows, null, 2));
const users = await query(`SELECT id, username FROM users`);
console.log('users:', JSON.stringify(users, null, 2));
process.exit(0);
