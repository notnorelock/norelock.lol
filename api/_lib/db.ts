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
 * A per-day, salted digest of the address.
 *
 * Three things make this a pseudonym rather than stored personal data:
 *
 *  - the salt is a secret only the server knows, so the whole IPv4 space
 *    cannot simply be hashed and looked up in a rainbow table;
 *  - the current date is mixed in, so yesterday's digest cannot be matched
 *    against today's, which rules out tracking someone over time;
 *  - only the digest is written, never the address itself.
 *
 * Without a configured salt the digests would be trivially reversible, so the
 * function refuses to produce one rather than pretending to anonymise.
 */
export async function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error('IP_HASH_SALT is not set; refusing to store a weak digest');

  const day = new Date().toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(`${salt}:${day}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Anything that exposes headers the way the Web Request does.
 *
 * The edge runtime hands over a real Request; the Node runtime hands over
 * Node's IncomingMessage, which api/download.ts wraps to match. Only headers
 * are ever read here, so this is all the shape these helpers need.
 */
export interface HeaderSource {
  headers: { get(name: string): string | null };
}

/** The caller's address, as far as the platform will tell us. */
export function clientIp(request: HeaderSource) {
  const forwarded = request.headers.get('x-forwarded-for');
  return (
    request.headers.get('x-real-ip') ??
    forwarded?.split(',')[0]?.trim() ??
    ''
  );
}
