import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, normalize } from 'node:path';
import { tracks } from './_lib/tracks.js';
import { clientIp, COOLDOWN_MINUTES, ensureSchema, hashIp, sql } from './_lib/db.js';
import type { HeaderSource } from './_lib/db.js';
import { screenRequest } from './_lib/vpn.js';

// Node runtime, not edge: this reads the source files from disk, and they are
// deliberately outside public/ so they have no public URL.
export const config = { runtime: 'nodejs' };

/** Source audio lives here, outside public/, so it is never served directly. */
const MEDIA_DIR = 'media';

type NodeRequest = IncomingMessage;
type NodeResponse = ServerResponse;

/**
 * Presents Node's plain header object through the Headers-style `get()` the
 * shared helpers expect, so db.ts and vpn.ts work under either runtime.
 */
function asWebRequest(req: NodeRequest) {
  return {
    headers: {
      get(name: string) {
        const value = req.headers[name.toLowerCase()];
        return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
      },
    },
  };
}

/** Shorthand for the small text responses. */
function send(res: NodeResponse, status: number, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'text/plain', ...headers });
  res.end(body);
}

/**
 * Counts a download and streams the file back as an attachment.
 *
 *   /api/download?id=<track-id>
 *
 * The id is looked up in the generated track list, and the path comes from that
 * entry rather than the query string, so a caller cannot point this at another
 * file or inflate the count for a track that does not exist.
 *
 * The file is proxied rather than redirected to, because a redirect cannot add
 * Content-Disposition, and putting that header on /music/* directly would stop
 * the <audio> element from streaming the same path.
 *
 * Every guard below only decides whether the hit is *counted*. The file itself
 * is always served.
 */
export default async function handler(req: NodeRequest, res: NodeResponse) {
  // The Node runtime hands over Node's own req/res, not the Web Request and
  // Response of the edge runtime: req.url is a bare path and req.headers is a
  // plain object. Wrap it so the shared helpers keep their Headers-style API.
  const request = asWebRequest(req);
  const url = new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`);
  const id = url.searchParams.get('id');

  // ?debug=1 explains what the counter would do, without sending the file.
  // Preview and development only: the report exposes part of the visitor's
  // address and the state of the database.
  if (url.searchParams.get('debug') === '1' && process.env.VERCEL_ENV !== 'production') {
    return send(res, 200, JSON.stringify(await debugReport(request, id), null, 2), {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
  }

  const track = tracks.find((item) => item.id === id);
  if (!track) return send(res, 404, 'unknown track');
  if (track.downloadable === false) return send(res, 403, 'not downloadable');

  // track.src comes from the generated list, but normalise anyway so a stray
  // '..' could never walk out of the media directory.
  const relative = normalize(track.src).replace(/^(\.\.[\/])+/, '');
  const path = join(process.cwd(), MEDIA_DIR, relative);

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return send(res, 404, 'file missing');
  }

  // Inline requests are the player falling back from HLS, not someone saving
  // the file, so they must not move the download counter.
  const inline = url.searchParams.get('inline') === '1';

  // Record the hit before responding: the function stops once it returns.
  if (!inline) await countDownload(request, track.id);

  const extension = track.src.split('.').pop() ?? 'mp3';
  const filename = `${track.title.replace(/["\/:*?<>|]/g, '')}.${extension}`;

  res.writeHead(200, {
    'content-type': 'audio/mpeg',
    'content-length': String(size),
    'content-disposition': inline ? 'inline' : `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  });

  // Pipe rather than buffer: a ten-megabyte track should not sit in memory.
  createReadStream(path).pipe(res);
}

/** Records one download unless it looks automated, proxied, or repeated. */
async function countDownload(request: HeaderSource, trackId: string) {
  if (!sql) return;

  const ip = clientIp(request);
  const rejected = await screenRequest(request, ip);
  if (rejected) {
    console.warn(`[download] not counted (${rejected})`);
    return;
  }

  try {
    await ensureSchema();
    const ipHash = await hashIp(ip || 'unknown');

    // Claim the (track, visitor) pair. The update only takes when the previous
    // hit is older than the cooldown, so a repeat inside the window changes
    // nothing and reports no rows.
    const claimed = (await sql`
      INSERT INTO download_hits (track_id, ip_hash, last_seen)
      VALUES (${trackId}, ${ipHash}, now())
      ON CONFLICT (track_id, ip_hash) DO UPDATE
        SET last_seen = now()
        WHERE download_hits.last_seen < now() - (${COOLDOWN_MINUTES}::int * interval '1 minute')
      RETURNING track_id
    `) as unknown[];

    if (!claimed.length) return;

    // The digest changes daily, so yesterday's rows can never match again.
    // Clearing them keeps the table from growing and means nothing about a
    // visitor is retained beyond the window it is needed for.
    await sql`DELETE FROM download_hits WHERE last_seen < now() - interval '2 days'`;

    await sql`
      INSERT INTO downloads (track_id, count, updated_at)
      VALUES (${trackId}, 1, now())
      ON CONFLICT (track_id)
      DO UPDATE SET count = downloads.count + 1, updated_at = now()
    `;
  } catch (error) {
    // Counting is best effort, but a silent failure is impossible to debug.
    console.error('[download] count failed:', error instanceof Error ? error.message : error);
  }
}

/** Explains, step by step, why a hit would or would not be counted. */
async function debugReport(request: HeaderSource, id: string | null) {
  const track = tracks.find((item) => item.id === id);
  const ip = clientIp(request);

  const report: Record<string, unknown> = {
    id,
    trackFound: Boolean(track),
    hasDatabase: Boolean(sql),
    ip: ip ? `${ip.slice(0, 4)}...` : '(none)',
    userAgent: request.headers.get('user-agent')?.slice(0, 40) ?? null,
    secFetchSite: request.headers.get('sec-fetch-site'),
    forwardedHops: request.headers.get('x-forwarded-for')?.split(',').length ?? 0,
    via: request.headers.get('via'),
    forwarded: request.headers.get('forwarded'),
  };

  try {
    report.rejectedBecause = (await screenRequest(request, ip)) ?? '(counted)';
  } catch (error) {
    report.screenError = error instanceof Error ? error.message : String(error);
  }

  if (sql) {
    try {
      await ensureSchema();
      report.schemaOk = true;
      const rows = (await sql`SELECT track_id, count FROM downloads`) as unknown[];
      report.rowsInDownloads = rows.length;
      const hits = (await sql`SELECT count(*) AS n FROM download_hits`) as { n: string }[];
      report.rowsInHits = Number(hits[0]?.n ?? 0);
    } catch (error) {
      report.dbError = error instanceof Error ? error.message : String(error);
    }
  }

  return report;
}
