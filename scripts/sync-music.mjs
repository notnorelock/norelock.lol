/**
 * Reads every mp3 under media/, pulls its ID3 tags, extracts the
 * embedded cover art, measures the waveform, and rewrites src/data/tracks.ts.
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
const TRACKS_FILE = 'src/data/tracks.ts';
const PEAKS_FILE = 'src/data/peaks.json';
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
  if (!existsSync(TRACKS_FILE)) return {};

  const source = readFileSync(TRACKS_FILE, 'utf8');
  const kept = {};

  for (const block of source.split(/\n {2}\{\n/).slice(1)) {
    const id = (block.match(/id: '([^']+)'/) || [])[1];
    if (!id) continue;
    kept[id] = {
      subtitle: (block.match(/subtitle: (['"])([\s\S]*?)\1/) || [])[2],
      tags: (block.match(/tags: \[([^\]]*)\]/) || [])[1],
      downloadable: /downloadable: false/.test(block) ? false : undefined,
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

const body = entries
  .map((entry) => {
    const lines = [
      "    id: '" + entry.id + "',",
      '    title: ' + quote(entry.title) + ',',
      entry.subtitle ? '    subtitle: ' + quote(entry.subtitle) + ',' : null,
      '    year: ' + entry.year + ',',
      '    duration: ' + entry.duration + ',',
      "    src: '" + entry.src + "',",
      "    cover: '" + entry.cover + "',",
      entry.album ? "    album: '" + entry.album + "'," : null,
      entry.albumTitle ? '    albumTitle: ' + quote(entry.albumTitle) + ',' : null,
      entry.trackNo ? '    trackNo: ' + entry.trackNo + ',' : null,
      "    peaks: peaksFor('" + entry.id + "', " + entry.id.length * 7 + '),',
      "    hasRealPeaks: hasPeaks('" + entry.id + "'),",
      entry.tags ? '    tags: [' + entry.tags + '],' : null,
      entry.downloadable === false ? '    downloadable: false,' : null,
    ].filter(Boolean);
    return '  {\n' + lines.join('\n') + '\n  },';
  })
  .join('\n');

const header = [
  "import generatedPeaks from './peaks.json';",
  '',
  'export interface Track {',
  '  id: string;',
  '  title: string;',
  '  /** Optional secondary line: remix credit, feature, release name. */',
  '  subtitle?: string;',
  '  year: number;',
  '  /** Runtime in seconds, read from the file itself. */',
  '  duration: number;',
  '  /** Path under public/, e.g. /music/hellfire.mp3 */',
  '  src: string;',
  '  /** Path under public/, e.g. /music/covers/hellfire.jpg */',
  '  cover: string;',
  '  /** Folder slug this track lives in. Absent for singles. */',
  '  album?: string;',
  '  /** Display name of the album, from the ID3 tag when it has one. */',
  '  albumTitle?: string;',
  '  /** Track number inside its album. */',
  '  trackNo?: number;',
  '  /** Peak values 0..1, one per waveform bar. */',
  '  peaks: number[];',
  '  /** False until the real file has been analysed. */',
  '  hasRealPeaks: boolean;',
  '  /** Set false to hide the download button for a single track. */',
  '  downloadable?: boolean;',
  '  tags?: string[];',
  '}',
  '',
  'export interface Release {',
  '  /** Album slug, or undefined for the loose singles group. */',
  '  album?: string;',
  '  title: string;',
  '  year: number;',
  '  cover: string;',
  '  tracks: Track[];',
  '}',
  '',
  '/** Placeholder shape used when a track has no generated peaks yet. */',
  'const placeholderPeaks = (seed: number, bars = 120) =>',
  '  Array.from({ length: bars }, (_, i) => {',
  '    const wave = Math.sin((i + seed) * 0.28) * 0.5 + 0.5;',
  '    const detail = Math.sin((i + seed) * 1.7) * 0.22;',
  '    return Math.min(1, Math.max(0.08, wave * 0.72 + detail + 0.18));',
  '  });',
  '',
  'const generated = generatedPeaks as Record<string, number[]>;',
  '',
  'const peaksFor = (id: string, seed: number) => generated[id] ?? placeholderPeaks(seed);',
  'const hasPeaks = (id: string) => Boolean(generated[id]?.length);',
  '',
  '// Generated by `bun run music`. title/year/duration/cover/album come from the',
  '// files; subtitle, tags and downloadable are kept across runs.',
  'export const tracks: Track[] = [',
].join('\n');

const footer = [
  '',
  '/** Albums first, then whatever is left over as singles. */',
  'export const releases: Release[] = (() => {',
  '  const albums = new Map<string, Release>();',
  '  const singles: Track[] = [];',
  '',
  '  for (const track of tracks) {',
  '    if (!track.album) {',
  '      singles.push(track);',
  '      continue;',
  '    }',
  '',
  '    const existing = albums.get(track.album);',
  '    if (existing) {',
  '      existing.tracks.push(track);',
  '      existing.year = Math.max(existing.year, track.year);',
  '    } else {',
  '      albums.set(track.album, {',
  '        album: track.album,',
  '        title: track.albumTitle ?? track.album,',
  '        year: track.year,',
  '        cover: track.cover,',
  '        tracks: [track],',
  '      });',
  '    }',
  '  }',
  '',
  '  const grouped = [...albums.values()].sort((a, b) => b.year - a.year);',
  '',
  '  if (singles.length) {',
  '    grouped.push({',
  '      title: singles.length === tracks.length ? "tracks" : "singles",',
  '      year: Math.max(...singles.map((t) => t.year)),',
  '      cover: singles[0].cover,',
  '      tracks: singles,',
  '    });',
  '  }',
  '',
  '  return grouped;',
  '})();',
].join('\n');

await writeFile(PEAKS_FILE, JSON.stringify(peaksOut, null, 2) + '\n');
await writeFile(TRACKS_FILE, header + '\n' + body + '\n];\n' + footer + '\n');

const albumCount = new Set(entries.filter((e) => e.album).map((e) => e.album)).size;
console.log(
  '\nwrote ' + TRACKS_FILE + ' (' + entries.length + ' tracks' +
    (albumCount ? ', ' + albumCount + ' album' + (albumCount > 1 ? 's' : '') : '') + ')',
);
console.log('wrote ' + PEAKS_FILE);
