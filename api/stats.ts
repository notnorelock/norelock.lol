import trackData from './_lib/tracks.json' with { type: 'json' };
import { ensureSchema, hasDatabase, sql } from './_lib/db.js';

/**
 * Rows of the generated tracks.json. The shape is declared here rather than in
 * a shared module: the functions must not depend on a sibling source file that
 * Vercel may not deploy alongside them.
 */
interface ApiTrack {
  id: string;
  title: string;
  subtitle?: string;
  year: number;
  duration: number;
  /** Path inside media/. Server-side only; never sent to the browser. */
  src: string;
  cover: string;
  album?: string;
  albumTitle?: string;
  trackNo?: number;
  tags?: string[];
  downloadable?: boolean;
  peaks: number[];
}

const tracks = trackData as ApiTrack[];

export const config = { runtime: 'edge' };

/**
 * Download counts as { counts: { "<track-id>": <count> }, status }.
 *
 * Every known track is listed, including the ones nobody has downloaded, so
 * the UI can show a real zero instead of leaving a gap. `status` says why the
 * numbers might be missing, because an empty table and a broken connection
 * otherwise look identical from the client.
 */
export default async function handler() {
  const counts: Record<string, number> = {};
  for (const track of tracks) counts[track.id] = 0;

  if (!sql) {
    return Response.json(
      { counts, status: hasDatabase ? 'error' : 'no-database' },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    await ensureSchema();
    const rows = (await sql`SELECT track_id, count FROM downloads`) as {
      track_id: string;
      count: string | number;
    }[];

    // Ignore rows for tracks that no longer exist, so a rename does not leave
    // an orphaned number in the response.
    for (const row of rows) {
      if (row.track_id in counts) counts[row.track_id] = Number(row.count);
    }

    return Response.json(
      { counts, status: 'ok' },
      // Always read through to the database: a cached count is a wrong count.
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        counts,
        status: 'error',
        message: error instanceof Error ? error.message : 'query failed',
      },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  }
}
