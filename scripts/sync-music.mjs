/**
 * Reads every mp3 under media/, pulls its ID3 tags, extracts the
 * embedded cover art, measures the waveform, and rewrites api/_lib/tracks.ts,
 * which /api/tracks serves to the browser.
 *
 *   bun run music            scan, organise and regenerate
 *   bun run music -- --force re-extract covers that already exist
 *   bun run music -- --dry   show what would move without touching anything
 *
 * Album layout: a file sitting in media/<album>/ belongs to that album.
 * A loose file carrying an ID3 "album" tag is moved into its own folder. Loose
 * files without the tag stay in the root and are listed as singles.
 *
 * ffmpeg ships with the project (ffmpeg-static), so there is nothing to install.
 * Hand-edited subtitle/tags/downloadable fields survive a re-run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { ffmpeg, probe, runToFile } from './lib/ffmpeg.mjs';

// Source audio lives outside public/ so the files are never served directly;
// /api/download is the only way to get one.
const MUSIC_DIR = 'media';
const COVER_DIR = 'public/music/covers';
const API_TRACKS_FILE = 'api/_lib/tracks.ts';
const BARS = 120;

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry');

/** "no memory, pt. 1" -> "no-memory-pt-1" */
function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ID3 keys vary between encoders, so try a few spellings. */
function tag(tags, ...names) {
  for (const name of names) {
    for (const key of Object.keys(tags)) {
      if (key.toLowerCase() === name.toLowerCase() && String(tags[key]).trim()) {
        return String(tags[key]).trim();
      }
    }
  }
  return undefined;
}

/** Every mp3 under the music dir, excluding the generated covers folder. */
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

async function peaksFor(file) {
  const chunks = await new Promise((resolve, reject) => {
    const buffers = [];
    const stream = ffmpeg(file)
      .audioChannels(1)
      .audioFrequency(8000)
      .format('s16le')
      .on('error', reject)
      .pipe();

    stream.on('data', (chunk) => buffers.push(chunk));
    stream.on('end', () => resolve(buffers));
    stream.on('error', reject);
  });

  const raw = Buffer.concat(chunks);
  const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
  if (!samples.length) throw new Error('no audio decoded');

  const bucket = Math.floor(samples.length / BARS);
  const peaks = [];

  for (let i = 0; i < BARS; i += 1) {
    let peak = 0;
    for (let j = i * bucket; j < (i + 1) * bucket && j < samples.length; j += 1) {
      const value = Math.abs(samples[j]);
      if (value > peak) peak = value;
    }
    peaks.push(peak / 32768);
  }

  const loudest = Math.max(...peaks);
  const scale = loudest > 0 ? 1 / loudest : 1;
  return peaks.map((p) => Number(Math.min(1, Math.max(0.03, p * scale)).toFixed(3)));
}

/**
 * Writes the embedded cover to public/music/covers/<name>.jpg when present.
 * Album tracks share one file named after the album, so a twelve-track record
 * does not produce twelve copies of the same artwork.
 */
async function extractCover(file, name, streams) {
  const target = join(COVER_DIR, name + '.jpg');
  const href = '/music/covers/' + name + '.jpg';

  if (existsSync(target) && !force) return href;

  const hasArt = streams.some(
    (s) => s.codec_type === 'video' && s.disposition && s.disposition.attached_pic,
  );
  if (!hasArt) return href;

  try {
    await runToFile(() => ffmpeg(file).outputOptions('-an', '-c:v', 'copy', '-y').output(target));
    console.log('     cover -> ' + target);
  } catch {
    /* leave the path pointing at a file you can drop in by hand */
  }
  return href;
}

/** Keeps the fields a human edited, so a re-run does not wipe them. */
function readExisting() {
  if (!existsSync(API_TRACKS_FILE)) return {};

  const source = readFileSync(API_TRACKS_FILE, 'utf8');

  // Start after the '=' so the '[]' of the `ApiTrack[]` annotation is skipped.
  const assignment = source.indexOf('=', source.indexOf('export const tracks'));
  const start = assignment < 0 ? -1 : source.indexOf('[', assignment);
  if (start < 0) return {};

  let previous;
  try {
    previous = JSON.parse(source.slice(start, source.lastIndexOf(']') + 1));
  } catch {
    return {};
  }

  const kept = {};
  for (const track of previous) {
    kept[track.id] = {
      subtitle: track.subtitle,
      tags: Array.isArray(track.tags) ? track.tags.map((t) => "'" + t + "'").join(', ') : undefined,
      downloadable: track.downloadable === false ? false : undefined,
    };
  }
  return kept;
}

function quote(value) {
  return value.includes("'") ? '"' + value.replace(/"/g, '\\"') + '"' : "'" + value + "'";
}

/**
 * Path of the source file relative to media/, used by the download endpoint to
 * locate it on disk. This is not a public URL: the mp3 files are deliberately
 * not served, so /api/download is the only way to reach one.
 */
function toHref(path) {
  return relative(MUSIC_DIR, path).split(sep).join('/');
}

if (!existsSync(MUSIC_DIR)) {
  console.log('no ' + MUSIC_DIR + '/ directory - create it and drop some mp3s in');
  process.exit(0);
}

let files = (await findTracks(MUSIC_DIR)).sort();

if (!files.length) {
  console.log('no mp3 files under ' + MUSIC_DIR + '/ - drop some in and run this again');
  process.exit(0);
}

await mkdir(COVER_DIR, { recursive: true });

// Pass 1: move loose files carrying an album tag into media/<album>/.
const moved = [];

for (const file of files) {
  if (dirname(file) !== MUSIC_DIR.split('/').join(sep) && dirname(file) !== MUSIC_DIR) continue;

  try {
    const data = await probe(file);
    const album = tag((data.format && data.format.tags) || {}, 'album');
    if (!album) continue;

    const folder = join(MUSIC_DIR, slugify(album));
    const target = join(folder, basename(file));
    if (existsSync(target)) continue;

    if (dryRun) {
      console.log('would move ' + basename(file) + ' -> ' + slugify(album) + '/');
    } else {
      await mkdir(folder, { recursive: true });
      await rename(file, target);
      console.log('moved ' + basename(file) + ' -> ' + slugify(album) + '/');
    }
    moved.push([file, target]);
  } catch {
    /* unreadable file; pass 2 reports it properly */
  }
}

if (dryRun) {
  console.log('\ndry run - nothing written');
  process.exit(0);
}

if (moved.length) files = (await findTracks(MUSIC_DIR)).sort();

// Pass 2: read every track and build the data file.
const existing = readExisting();
const entries = [];
const peaksOut = {};

for (const file of files) {
  const id = slugify(basename(file, extname(file)));
  const folder = dirname(file);
  const inAlbumFolder = folder !== MUSIC_DIR && folder !== MUSIC_DIR.split('/').join(sep);

  try {
    const data = await probe(file);
    const tags = (data.format && data.format.tags) || {};

    const title = tag(tags, 'title') || basename(file, extname(file));
    const rawYear = tag(tags, 'date', 'year', 'TDRC', 'originalyear') || '';
    const year = Number(rawYear.slice(0, 4)) || new Date().getFullYear();
    const duration = Math.round(Number(data.format && data.format.duration) || 0);
    const genre = tag(tags, 'genre');

    // The folder wins: it is what the person actually arranged on disk.
    const album = inAlbumFolder ? basename(folder) : undefined;
    const albumTitle = inAlbumFolder ? tag(tags, 'album') || basename(folder) : undefined;
    const trackNo = Number((tag(tags, 'track') || '').split('/')[0]) || undefined;

    // One cover per album; singles keep their own.
    const cover = await extractCover(file, album || id, data.streams || []);
    peaksOut[id] = await peaksFor(file);

    const kept = existing[id] || {};

    entries.push({
      id,
      title,
      subtitle: kept.subtitle,
      year,
      duration,
      src: toHref(file),
      cover,
      album,
      albumTitle,
      trackNo,
      tags: kept.tags || (genre ? "'" + genre.toLowerCase() + "'" : undefined),
      downloadable: kept.downloadable,
    });

    console.log(
      'ok   ' + id + '  "' + title + '" (' + year + ', ' + duration + 's)' +
        (album ? '  [' + album + (trackNo ? ' #' + trackNo : '') + ']' : ''),
    );
  } catch (error) {
    console.error('fail ' + file + ': ' + String(error.message || error).split('\n')[0]);
  }
}

if (!entries.length) {
  console.error('\nnothing could be read - are those valid mp3 files?');
  process.exit(1);
}

// Newest first; inside an album follow the track numbers.
entries.sort((a, b) => {
  if (a.album && a.album === b.album) {
    return (a.trackNo || 99) - (b.trackNo || 99) || a.title.localeCompare(b.title);
  }
  return b.year - a.year || a.title.localeCompare(b.title);
});

const albumCount = new Set(entries.filter((e) => e.album).map((e) => e.album)).size;

// The serverless functions need the same list, but importing src/data/tracks.ts
// from api/ fails at runtime: Vercel compiles api/ in place and does not bundle
// modules from outside it. Emit a self-contained copy next to the functions.
const apiTracks = entries.map((entry) => ({
  id: entry.id,
  title: entry.title,
  subtitle: entry.subtitle,
  year: entry.year,
  duration: entry.duration,
  // Path inside media/. Never sent to the browser: the client only ever asks
  // for a track by id.
  src: entry.src,
  cover: entry.cover,
  // Slugified, because the client derives the HLS path from it and
  // build-hls.mjs writes those folders slugified too.
  album: entry.album ? slugify(entry.album) : undefined,
  albumTitle: entry.albumTitle,
  trackNo: entry.trackNo,
  tags: entry.tags ? entry.tags.split(',').map((t) => t.trim().replace(/^'|'$/g, '')) : undefined,
  downloadable: entry.downloadable,
  peaks: peaksOut[entry.id] ?? [],
}));

// A plain .ts module, not JSON: Vercel's bundler rejects the
// `with { type: 'json' }` import attribute. The import in the functions must
// end in .js, because package.json sets "type": "module" and ESM requires it.
const apiFile = [
  '// Generated by scripts/sync-music.mjs. Do not edit by hand.',
  '//',
  '// Read by the API routes and served, minus `src`, by /api/tracks.',
  '',
  'export interface ApiTrack {',
  '  id: string;',
  '  title: string;',
  '  subtitle?: string;',
  '  year: number;',
  '  duration: number;',
  '  /** Path inside media/. Server-side only; never sent to the browser. */',
  '  src: string;',
  '  cover: string;',
  '  album?: string;',
  '  albumTitle?: string;',
  '  trackNo?: number;',
  '  tags?: string[];',
  '  downloadable?: boolean;',
  '  peaks: number[];',
  '}',
  '',
  'export const tracks: ApiTrack[] = ' + JSON.stringify(apiTracks, null, 2) + ';',
  '',
].join('\n');

await writeFile(API_TRACKS_FILE, apiFile);
console.log('wrote ' + API_TRACKS_FILE);
