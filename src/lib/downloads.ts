import { createSignal } from 'solid-js';
import type { Track } from '@/data/tracks';

const [counts, setCounts] = createSignal<Record<string, number>>({});
let fetched = false;

/** Download totals by track id. Empty until the request lands, or if it fails. */
export const downloadCounts = counts;

/** Fetches the totals once per page load; safe to call from several places. */
export async function loadDownloadCounts() {
  if (fetched) return;
  fetched = true;

  try {
    const response = await fetch('/api/stats');
    // Without the Vercel routing in front (dev, preview), this path falls
    // through to index.html, so check the type before parsing.
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return;
    }

    const body = (await response.json()) as {
      counts?: Record<string, number>;
      status?: string;
      message?: string;
    };

    if (body.status && body.status !== 'ok') {
      console.warn(`[downloads] stats unavailable: ${body.status}`, body.message ?? '');
    }

    if (body.counts) setCounts(body.counts);
  } catch {
    // No backend, or the request failed. The UI falls back to zeros.
  }
}

/**
 * The URL a download button should point at, counting the hit on the way.
 * Only the id travels: the server resolves the path from its own copy of the
 * track list.
 */
export function downloadHref(track: Track) {
  // The endpoint only exists on Vercel; in `vite dev` there is nothing behind
  // /api, so point straight at the file and skip counting.
  if (import.meta.env.DEV) return track.src;
  return `/api/download?id=${encodeURIComponent(track.id)}`;
}

/** Optimistically bumps the local number so the UI reacts immediately. */
export function noteDownload(track: Track) {
  setCounts((previous) => ({ ...previous, [track.id]: (previous[track.id] ?? 0) + 1 }));
}

export function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}
