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
/** How long the same address is ignored for a given track. */
export const COOLDOWN_MINUTES = 60;

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

    // One row per visitor per track, used to ignore repeat hits inside the
    // cooldown. The ip is stored hashed so the table holds no raw addresses.
    await sql`
      CREATE TABLE IF NOT EXISTS download_hits (
        track_id text NOT NULL,
        ip_hash text NOT NULL,
        last_seen timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (track_id, ip_hash)
      )
    `;
  })();

  return ready;
}

/**
 * SHA-256 of the address plus a server-side salt. Storing a hash means the
 * counter works without keeping personal data around.
 */
export async function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? 'norelock';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The caller's address, as far as the platform will tell us. */
export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return (
    request.headers.get('x-real-ip') ??
    forwarded?.split(',')[0]?.trim() ??
    ''
  );
}
