import { createSignal } from 'solid-js';
import type { Track } from '@/lib/catalog';

const [counts, setCounts] = createSignal<Record<string, number>>({});

/** Download totals by track id. Empty until the request lands, or if it fails. */
export const downloadCounts = counts;

/** In-flight request, so several callers in one tick share one round trip. */
let pending: Promise<void> | undefined;

/** Fetches the totals. Every call hits the server, so the numbers stay current. */
export async function loadDownloadCounts() {
  if (pending) return pending;

  pending = (async () => {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });

      // Without the Vercel routing in front (dev, preview), this path falls
      // through to index.html, so check the type before parsing.
      const type = response.headers.get('content-type');
      if (!response.ok || !type?.includes('application/json')) return;

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
    } finally {
      pending = undefined;
    }
  })();

  return pending;
}

/**
 * The URL a download button should point at, counting the hit on the way.
 * Only the id travels: the server resolves the path from its own copy of the
 * track list.
 */
export function downloadHref(track: Track) {
  return `/api/download?id=${encodeURIComponent(track.id)}`;
}

/**
 * Bumps the local number so the UI reacts on click, then re-reads the real
 * total shortly after. The delay is there because the server counts the hit
 * after it has finished sending the file, and the count may be rejected
 * anyway (repeat within the cooldown, VPN), in which case the refetch quietly
 * corrects the optimistic guess.
 */
export function noteDownload(track: Track) {
  setCounts((previous) => ({ ...previous, [track.id]: (previous[track.id] ?? 0) + 1 }));

  window.setTimeout(() => {
    pending = undefined;
    void loadDownloadCounts();
  }, 1500);
}

export function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}
