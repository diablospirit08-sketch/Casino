// Run all migrations in order against the configured DATABASE_URL.
// Usage: node migrations/run.js
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Track which migrations have run
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        ran_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: done } = await client.query('SELECT filename FROM _migrations');
    const ran = new Set(done.map(r => r.filename));

    const files = readdirSync(__dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (ran.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = readFileSync(join(__dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations(filename) VALUES($1)', [file]);
        await client.query('COMMIT');
        console.log(`ran   ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAIL  ${file}:`, err.message);
        process.exit(1);
      }
    }
    console.log('migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

run();
