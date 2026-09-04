import { tracks } from '../src/data/tracks';
import { clientIp, COOLDOWN_MINUTES, ensureSchema, hashIp, sql } from './_lib/db';
import { screenRequest } from './_lib/vpn';

export const config = { runtime: 'edge' };

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
export default async function handler(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  // ?debug=1 explains what the counter would do, without sending the file.
  // Preview and development only: the report exposes part of the visitor's
  // address and the state of the database.
  if (url.searchParams.get('debug') === '1' && process.env.VERCEL_ENV !== 'production') {
    return debugReport(request, id);
  }

  const track = tracks.find((item) => item.id === id);
  if (!track) {
    return new Response('unknown track', { status: 404 });
  }

  if (track.downloadable === false) {
    return new Response('not downloadable', { status: 403 });
  }

  // Fetch the file and record the hit at the same time. The write has to be
  // awaited before responding, because an edge function stops executing the
  // moment it returns, dropping anything still running in the background.
  const [upstream] = await Promise.all([
    fetch(new URL(track.src, url.origin)),
    countDownload(request, track.id),
  ]);

  if (!upstream.ok || !upstream.body) {
    return new Response('file missing', { status: 404 });
  }

  const extension = track.src.split('.').pop() ?? 'mp3';
  const filename = `${track.title.replace(/["\/:*?<>|]/g, '')}.${extension}`;

  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

/** Records one download unless it looks automated, proxied, or repeated. */
async function countDownload(request: Request, trackId: string) {
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
async function debugReport(request: Request, id: string | null) {
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

  return Response.json(report, { headers: { 'cache-control': 'no-store' } });
}
