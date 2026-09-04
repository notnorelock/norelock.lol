import { createSignal, onCleanup } from 'solid-js';
import type { Track } from '@/data/tracks';

/**
 * One <audio> element drives the whole page, so the row and the docked bar
 * always agree on what is playing.
 */
let audio: HTMLAudioElement | undefined;
let trackingFrame = 0;

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
      startTracking();
    });
    audio.addEventListener('pause', () => {
      setPlaying(false);
      stopTracking();
    });
    audio.addEventListener('waiting', () => setLoading(true));
    audio.addEventListener('ended', () => {
      setPlaying(false);
      stopTracking();
      setPosition(0);
    });
    audio.addEventListener('error', () => {
      setLoading(false);
      setPlaying(false);
      stopTracking();
      setFailed(true);
    });
  }
  return audio;
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

  async play(track: Track) {
    const el = element();

    if (current()?.id !== track.id) {
      setCurrent(track);
      setPosition(0);
      setFailed(false);
      // Fall back to the hand-written duration until metadata arrives.
      setDuration(track.duration);
      el.src = track.src;
      setLoading(true);
    }

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

  toggle(track: Track) {
    if (current()?.id === track.id && playing()) {
      player.pause();
      return;
    }
    void player.play(track);
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
    el.pause();
    el.removeAttribute('src');
    el.load();
    setCurrent(undefined);
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
      player.seek(position() + 5);
    } else if (event.code === 'ArrowLeft') {
      player.seek(position() - 5);
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
