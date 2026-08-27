import { Pool, PoolClient } from 'pg';
import { config } from '../config/env.js';

export const pool = new Pool({
  connectionString: config.postgresUrl,
});

export async function withUserContext<T>(userId: string, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  return pool.query<T>(text, params);
}
