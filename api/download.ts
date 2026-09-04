import { tracks } from '../src/data/tracks';
import { ensureSchema, sql } from './_lib/db';

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

  if (sql) {
    try {
      await ensureSchema();
      await sql`
        INSERT INTO downloads (track_id, count, updated_at)
        VALUES (${track.id}, 1, now())
        ON CONFLICT (track_id)
        DO UPDATE SET count = downloads.count + 1, updated_at = now()
      `;
    } catch {
      /* counting is best effort; the file still has to arrive */
    }
  }

  // Name the file after the track rather than the slug on disk.
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
