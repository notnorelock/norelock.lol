import trackData from './_lib/tracks.json' with { type: 'json' };

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
 * The track list the music page renders, waveform data included.
 *
 * Serving this instead of bundling it keeps the payload off the home page,
 * which never needs it, and stops the peak arrays from growing the JS bundle
 * with every release.
 *
 * `src` is dropped: it is a path inside media/ that only the server needs, and
 * the client asks for audio by id anyway.
 */
export default function handler() {
  const payload = tracks.map(({ src, ...track }) => track);

  return Response.json(
    { tracks: payload },
    {
      headers: {
        // The list only changes on deploy, so it can be cached hard; a new
        // build produces a new deployment and invalidates it.
        'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
