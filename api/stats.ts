import { tracks } from '../src/data/tracks';
import { ensureSchema, sql } from './_lib/db';

export const config = { runtime: 'edge' };

/**
 * Download counts as { "<track-id>": <count> }, limited to tracks that still
 * exist, so a renamed or deleted file stops reporting an orphaned number.
 * Returns an empty object when no database is configured.
 */
export default async function handler() {
  if (!sql) {
    return Response.json({}, { headers: { 'cache-control': 'no-store' } });
  }

  try {
    await ensureSchema();
    const rows = (await sql`SELECT track_id, count FROM downloads`) as {
      track_id: string;
      count: string | number;
    }[];

    const known = new Set(tracks.map((track) => track.id));
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (known.has(row.track_id)) counts[row.track_id] = Number(row.count);
    }

    return Response.json(counts, {
      // A few seconds of lag is fine; minutes of a stale number is not.
      headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch {
    return Response.json({}, { status: 200, headers: { 'cache-control': 'no-store' } });
  }
}
