/**
 * Turns every mp3 under public/music/ into an HLS stream, so playback pulls a
 * few seconds at a time instead of the whole file.
 *
 *   bun run hls
 *
 * Runs as part of the Vercel build, which is why the output goes to dist/
 * rather than public/: the segments are a build artifact, not a source file,
 * and keeping them out of git avoids doubling the repo size.
 *
 * The original mp3 is left untouched — the download button still serves it.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { ffmpeg, runToFile } from './lib/ffmpeg.mjs';

const MUSIC_DIR = 'media';
const OUT_ROOT = 'dist/music';
/** Long enough to keep request counts low, short enough to start fast. */
const SEGMENT_SECONDS = 10;

/** Every mp3 under the music dir, ignoring the generated covers folder. */
async function findTracks(dir, depth = 0) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'covers' || depth >= 2) continue;
      found.push(...(await findTracks(path, depth + 1)));
    } else if (extname(entry.name).toLowerCase() === '.mp3') {
      found.push(path);
    }
  }
  return found;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Re-encodes to AAC, the codec HLS players expect.
 *
 * Two details matter here. `-map 0:a:0 -vn` drops the embedded cover art: an
 * mp3 with artwork carries a second (video) stream, and trying to segment that
 * into MPEG-TS silently produces one giant chunk instead of many. Copying the
 * mp3 stream as-is has the same effect, because it lacks the timestamps the
 * segmenter needs — so re-encoding is not optional here.
 */
async function toHls(file, outDir, id) {
  await mkdir(outDir, { recursive: true });

  await runToFile(() =>
    ffmpeg(file)
      .outputOptions([
        '-map', '0:a:0',
        '-vn',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-f', 'hls',
        '-hls_time', String(SEGMENT_SECONDS),
        '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', join(outDir, `${id}-%03d.ts`),
      ])
      .output(join(outDir, `${id}.m3u8`)),
  );
}

if (!existsSync(MUSIC_DIR)) {
  console.log(`no ${MUSIC_DIR}/ — nothing to segment`);
  process.exit(0);
}

const files = (await findTracks(MUSIC_DIR)).sort();

if (!files.length) {
  console.log('no mp3 files found — nothing to segment');
  process.exit(0);
}

if (!existsSync('dist')) {
  console.error('dist/ is missing — run this after `vite build`');
  process.exit(1);
}

let done = 0;

for (const file of files) {
  const id = slugify(basename(file, extname(file)));

  // Slugify each folder: fluent-ffmpeg passes the segment template through a
  // shell string, so a space in "no memory" would truncate the path.
  const relativeDir = relative(MUSIC_DIR, dirname(file))
    .split(sep)
    .filter(Boolean)
    .map(slugify)
    .join(sep);
  const outDir = relativeDir ? join(OUT_ROOT, relativeDir) : OUT_ROOT;

  try {
    await toHls(file, outDir, id);
    const href = ['/music', ...relativeDir.split(sep).filter(Boolean), `${id}.m3u8`].join('/');
    console.log(`ok   ${id} -> ${href}`);
    done += 1;
  } catch (error) {
    // A failed segment just means that track falls back to the plain mp3.
    console.error(`fail ${id}: ${String(error.message || error).split('\n')[0]}`);
  }
}

// Tell the client which tracks actually have a stream, so it can fall back
// to the mp3 for any that failed here.
await writeFile(
  join('dist', 'hls-manifest.json'),
  `${JSON.stringify({ segmentSeconds: SEGMENT_SECONDS, generated: done }, null, 2)}\n`,
);

console.log(`\nsegmented ${done}/${files.length} track(s) into ${OUT_ROOT}/`);
