import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('pg pool error', err);
});

/**
 * Run a callback inside a serializable transaction.
 * The callback receives a pg PoolClient. If it throws, the transaction
 * is rolled back and the error re-thrown.
 *
 * Usage:
 *   const result = await transaction(async (tx) => {
 *     const { rows } = await tx.query('SELECT ...', [...]);
 *     await tx.query('INSERT ...', [...]);
 *     return rows[0];
 *   });
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Convenience wrapper for single queries that don't need a transaction.
 */
export async function query(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}
