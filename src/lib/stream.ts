import type { Track } from '@/data/tracks';

/**
 * HLS playback.
 *
 * The build slices every mp3 into ten-second segments, so playing a track
 * pulls only what is being listened to instead of the whole file. The original
 * mp3 stays available for downloads and as a fallback.
 */

/** Where build-hls.mjs writes a track's playlist. */
export function streamUrl(track: Track) {
  // track.src is a path inside media/, e.g. "no memory/whisper your name.mp3".
  const parts = track.src.split('/').filter(Boolean);
  const dir = parts.slice(0, -1);
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  return ['/music', ...dir.map(slug), `${track.id}.m3u8`].join('/');
}

/**
 * The only public route to the audio itself. The mp3 files live outside
 * public/, so this endpoint is the fallback when HLS cannot be used.
 */
function fileUrl(track: Track) {
  return `/api/download?id=${encodeURIComponent(track.id)}&inline=1`;
}

/** Safari plays HLS directly; everywhere else needs the library. */
function nativeHls(el: HTMLAudioElement) {
  return el.canPlayType('application/vnd.apple.mpegurl') !== '';
}

let hls: { destroy(): void; loadSource(u: string): void; attachMedia(e: HTMLAudioElement): void } | undefined;

/** Tears down any previous stream before a new track starts. */
export function detachStream() {
  hls?.destroy();
  hls = undefined;
}

/**
 * Points the element at `track`, preferring the segmented stream.
 * Falls back to the plain mp3 if HLS cannot be used or fails to load.
 */
export async function attachTrack(el: HTMLAudioElement, track: Track, onFallback?: () => void) {
  detachStream();

  const playlist = streamUrl(track);

  if (nativeHls(el)) {
    el.src = playlist;
    return;
  }

  try {
    const { default: Hls } = await import('hls.js');

    if (!Hls.isSupported()) {
      el.src = fileUrl(track);
      return;
    }

    const instance = new Hls({
      // Keep a modest buffer: this is music, not video, and the segments are
      // small enough that aggressive prefetching wastes the bandwidth we set
      // out to save.
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      enableWorker: true,
    });

    instance.on(Hls.Events.ERROR, (_event, data) => {
      // A missing playlist means the build did not segment this track; the mp3
      // is always there, so use it rather than failing outright.
      if (data.fatal) {
        instance.destroy();
        hls = undefined;
        el.src = fileUrl(track);
        onFallback?.();
      }
    });

    instance.loadSource(playlist);
    instance.attachMedia(el);
    hls = instance;
  } catch {
    el.src = fileUrl(track);
  }
}
