import { createSignal } from 'solid-js';

/**
 * The music catalogue, fetched from /api/tracks rather than bundled.
 *
 * Keeping it out of the bundle means the home page does not pay for waveform
 * data it never draws, and adding releases does not grow the JavaScript.
 */

export interface Track {
  id: string;
  title: string;
  subtitle?: string;
  year: number;
  /** Runtime in seconds. */
  duration: number;
  cover: string;
  album?: string;
  albumTitle?: string;
  trackNo?: number;
  tags?: string[];
  downloadable?: boolean;
  /** Peak values 0..1, one per waveform bar. */
  peaks: number[];
}

export interface Release {
  /** Album slug, or undefined for the loose singles group. */
  album?: string;
  title: string;
  year: number;
  cover: string;
  tracks: Track[];
}

const [tracks, setTracks] = createSignal<Track[]>([]);
const [loaded, setLoaded] = createSignal(false);
const [failed, setFailed] = createSignal(false);

export const allTracks = tracks;
export const catalogLoaded = loaded;
export const catalogFailed = failed;

let pending: Promise<void> | undefined;

/** Fetches the catalogue once; repeat callers share the same request. */
export function loadCatalog() {
  if (pending) return pending;

  pending = (async () => {
    try {
      const response = await fetch('/api/tracks');
      const type = response.headers.get('content-type');

      // Without the Vercel routing in front (plain `vite dev`), this path falls
      // through to index.html, so check before parsing.
      if (!response.ok || !type?.includes('application/json')) {
        setFailed(true);
        return;
      }

      const body = (await response.json()) as { tracks?: Track[] };
      setTracks(body.tracks ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  })();

  return pending;
}

/** Albums first, newest to oldest, then whatever is left over as singles. */
export function groupReleases(list: Track[]): Release[] {
  const albums = new Map<string, Release>();
  const singles: Track[] = [];

  for (const track of list) {
    if (!track.album) {
      singles.push(track);
      continue;
    }

    const existing = albums.get(track.album);
    if (existing) {
      existing.tracks.push(track);
      existing.year = Math.max(existing.year, track.year);
    } else {
      albums.set(track.album, {
        album: track.album,
        title: track.albumTitle ?? track.album,
        year: track.year,
        cover: track.cover,
        tracks: [track],
      });
    }
  }

  const grouped = [...albums.values()].sort((a, b) => b.year - a.year);

  for (const album of grouped) {
    album.tracks.sort((a, b) => (a.trackNo ?? 99) - (b.trackNo ?? 99));
  }

  if (singles.length) {
    grouped.push({
      title: singles.length === list.length ? 'tracks' : 'singles',
      year: Math.max(...singles.map((track) => track.year)),
      cover: singles[0].cover,
      tracks: singles,
    });
  }

  return grouped;
}
