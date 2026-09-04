import { tracks } from '../src/data/tracks';
import { clientIp, COOLDOWN_MINUTES, ensureSchema, hashIp, sql } from './_lib/db';
import { isSuspicious } from './_lib/vpn';

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

  const track = tracks.find((item) => item.id === id);
  if (!track) {
    return new Response('unknown track', { status: 404 });
  }

  if (track.downloadable === false) {
    return new Response('not downloadable', { status: 403 });
  }

  const upstream = await fetch(new URL(track.src, url.origin));
  if (!upstream.ok || !upstream.body) {
    return new Response('file missing', { status: 404 });
  }

  // Count in the background so screening never delays the download.
  const counted = countDownload(request, track.id);
  if (typeof (globalThis as { waitUntil?: unknown }).waitUntil !== 'function') {
    void counted;
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
  if (await isSuspicious(request, ip)) return;

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
        WHERE download_hits.last_seen < now() - (${COOLDOWN_MINUTES} || ' minutes')::interval
      RETURNING track_id
    `) as unknown[];

    if (!claimed.length) return;

    await sql`
      INSERT INTO downloads (track_id, count, updated_at)
      VALUES (${trackId}, 1, now())
      ON CONFLICT (track_id)
      DO UPDATE SET count = downloads.count + 1, updated_at = now()
    `;
  } catch {
    /* counting is best effort; the file has already been sent */
  }
}
