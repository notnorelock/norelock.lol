import { neon } from '@neondatabase/serverless';

/**
 * Neon over HTTP: no pooling to manage, which suits serverless functions that
 * run one query and exit.
 */
const url = process.env.DATABASE_URL;

export const hasDatabase = Boolean(url);

export const sql = url ? neon(url) : undefined;

let ready: Promise<void> | undefined;

/** Creates the counter table once per cold start. */
export function ensureSchema() {
  if (!sql) return Promise.resolve();

  ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS downloads (
        track_id text PRIMARY KEY,
        count bigint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  })();

  return ready;
}
