import { tracks } from './_lib/tracks.js';
import { ensureSchema, hasDatabase, sql } from './_lib/db.js';

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
