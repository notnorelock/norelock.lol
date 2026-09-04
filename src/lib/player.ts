import { createSignal, onCleanup } from 'solid-js';
import type { Track } from '@/data/tracks';
import { attachTrack, detachStream } from '@/lib/stream';

/**
 * One <audio> element drives the whole page, so the row and the docked bar
 * always agree on what is playing.
 */
let audio: HTMLAudioElement | undefined;
let trackingFrame = 0;

/**
 * Web Audio taps the element so visuals can react to what is playing. It is
 * created lazily on the first play, because an AudioContext made before a user
 * gesture starts suspended.
 */
let audioContext: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
let freqData: Uint8Array<ArrayBuffer> | undefined;

function connectAnalyser(el: HTMLAudioElement) {
  if (analyser || typeof AudioContext === 'undefined') return;

  try {
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(el);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch {
    // Cross-origin audio or an unsupported browser; visuals fall back to idle.
    analyser = undefined;
  }
}

/**
 * Current low/mid energy as 0..1, smoothed. Returns 0 when nothing is playing,
 * so callers can treat it as "how much is the music moving right now".
 */
export function audioLevel() {
  if (!analyser || !freqData || !playing()) return 0;

  analyser.getByteFrequencyData(freqData);

  // Bass and low mids carry the pulse; the top end just adds noise here.
  let sum = 0;
  const bins = Math.min(24, freqData.length);
  for (let i = 0; i < bins; i += 1) sum += freqData[i];

  return Math.min(1, sum / (bins * 255) * 1.6);
}
/** Guards against walking a whole queue of unplayable files in one tick. */
let consecutiveErrors = 0;

function startTracking() {
  if (trackingFrame) return;
  const tick = () => {
    if (audio) setPosition(audio.currentTime);
    trackingFrame = requestAnimationFrame(tick);
  };
  trackingFrame = requestAnimationFrame(tick);
}

function stopTracking() {
  cancelAnimationFrame(trackingFrame);
  trackingFrame = 0;
}

const [current, setCurrent] = createSignal<Track | undefined>();
/** The list the current track came from, so it can advance on its own. */
const [queue, setQueue] = createSignal<Track[]>([]);
const [playing, setPlaying] = createSignal(false);
const [position, setPosition] = createSignal(0);
const [duration, setDuration] = createSignal(0);
const [loading, setLoading] = createSignal(false);
const [failed, setFailed] = createSignal(false);
const [volume, setVolumeSignal] = createSignal(0.8);

function element() {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume();

    // timeupdate only fires ~4x a second, which reads as a stutter on the
    // waveform and the clock. Poll on rAF while playing instead.
    audio.addEventListener('timeupdate', () => setPosition(audio!.currentTime));
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio!.duration)) setDuration(audio!.duration);
    });
    audio.addEventListener('playing', () => {
      setPlaying(true);
      setLoading(false);
      setFailed(false);
      consecutiveErrors = 0;
      startTracking();
    });
    audio.addEventListener('pause', () => {
      setPlaying(false);
      stopTracking();
    });
    audio.addEventListener('waiting', () => setLoading(true));
    audio.addEventListener('ended', () => {
      stopTracking();
      setPosition(0);
      if (!playNext()) setPlaying(false);
    });
    audio.addEventListener('error', () => {
      setLoading(false);
      stopTracking();
      setFailed(true);
      // Skip past a file that will not load, but stop if the whole queue is bad.
      consecutiveErrors += 1;
      if (consecutiveErrors > 3 || !playNext()) {
        setPlaying(false);
        consecutiveErrors = 0;
      }
    });
  }
  return audio;
}

/** Index of the current track inside its queue, or -1 when it is standalone. */
function queueIndex() {
  const track = current();
  if (!track) return -1;
  return queue().findIndex((item) => item.id === track.id);
}

/** Starts the next queued track. Returns false when there is nothing after it. */
function playNext() {
  const index = queueIndex();
  if (index < 0) return false;

  const next = queue()[index + 1];
  if (!next) return false;

  void player.play(next, queue());
  return true;
}

export const player = {
  current,
  playing,
  position,
  duration,
  loading,
  failed,
  volume,

  isCurrent: (track: Track) => current()?.id === track.id,

  /** `list` makes the track part of a queue that advances on its own. */
  async play(track: Track, list?: Track[]) {
    const el = element();

    if (list) setQueue(list);
    else if (queueIndex() < 0) setQueue([track]);

    if (current()?.id !== track.id) {
      setCurrent(track);
      setPosition(0);
      setFailed(false);
      // Fall back to the hand-written duration until metadata arrives.
      setDuration(track.duration);
      setLoading(true);
      // Prefers the segmented stream, drops back to the mp3 on its own.
      await attachTrack(el, track);
    }

    connectAnalyser(el);
    void audioContext?.resume();

    try {
      await el.play();
    } catch {
      // Autoplay rejection or a missing file; the UI shows the failed state.
      setLoading(false);
      setPlaying(false);
    }
  },

  pause() {
    element().pause();
  },

  toggle(track: Track, list?: Track[]) {
    if (current()?.id === track.id && playing()) {
      player.pause();
      return;
    }
    void player.play(track, list);
  },

  queue,

  hasNext: () => {
    const index = queueIndex();
    return index >= 0 && index + 1 < queue().length;
  },

  hasPrevious: () => queueIndex() > 0,

  next() {
    playNext();
  },

  previous() {
    // Restart the track first, the way every other player behaves.
    if (position() > 3) {
      player.seek(0);
      return;
    }
    const index = queueIndex();
    const previous = index > 0 ? queue()[index - 1] : undefined;
    if (previous) void player.play(previous, queue());
    else player.seek(0);
  },

  seek(seconds: number) {
    const el = element();
    const total = duration();
    if (!total) return;
    el.currentTime = Math.min(total, Math.max(0, seconds));
    setPosition(el.currentTime);
  },

  /** ratio is 0..1 across the waveform. */
  seekRatio(ratio: number) {
    player.seek(ratio * (duration() || 0));
  },

  setVolume(value: number) {
    const clamped = Math.min(1, Math.max(0, value));
    setVolumeSignal(clamped);
    element().volume = clamped;
  },

  stop() {
    const el = element();
    stopTracking();
    detachStream();
    el.pause();
    el.removeAttribute('src');
    el.load();
    setCurrent(undefined);
    setQueue([]);
    setPlaying(false);
    setPosition(0);
  },
};

/** Registers global keyboard shortcuts; call once from the music page. */
export function usePlayerHotkeys() {
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    const track = current();
    if (!track) return;

    if (event.code === 'Space') {
      event.preventDefault();
      player.toggle(track);
    } else if (event.code === 'ArrowRight') {
      // Shift jumps tracks; plain arrows scrub.
      if (event.shiftKey) player.next();
      else player.seek(position() + 5);
    } else if (event.code === 'ArrowLeft') {
      if (event.shiftKey) player.previous();
      else player.seek(position() - 5);
    }
  };

  window.addEventListener('keydown', onKey);
  onCleanup(() => window.removeEventListener('keydown', onKey));
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
