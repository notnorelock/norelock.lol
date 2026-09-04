import { Show } from 'solid-js';
import {
  IconDownload,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconVolume,
  IconX,
} from '@tabler/icons-solidjs';
import { CoverArt } from '@/components/music/CoverArt';
import { Waveform } from '@/components/music/Waveform';
import { formatTime, player } from '@/lib/player';
import { downloadHref, noteDownload } from '@/lib/downloads';

export function PlayerBar() {
  const total = () => player.duration() || player.current()?.duration || 0;
  const progress = () => (total() ? player.position() / total() : 0);

  return (
    <Show when={player.current()}>
      {(track) => (
        <div class="player-bar" role="region" aria-label="Now playing">
          <div class="site-shell player-inner">
            <CoverArt class="player-cover" src={track().cover} size={44} eager />

            <div class="player-transport">
              <button
                type="button"
                class="player-skip"
                onClick={() => player.previous()}
                disabled={!player.hasPrevious() && player.position() < 3}
                aria-label="Previous track"
              >
                <IconPlayerSkipBackFilled size={14} />
              </button>

              <button
                type="button"
                class="player-toggle"
                onClick={() => player.toggle(track())}
                aria-label={player.playing() ? 'Pause' : 'Play'}
              >
                <Show when={player.playing()} fallback={<IconPlayerPlayFilled size={17} />}>
                  <IconPlayerPauseFilled size={17} />
                </Show>
              </button>

              <button
                type="button"
                class="player-skip"
                onClick={() => player.next()}
                disabled={!player.hasNext()}
                aria-label="Next track"
              >
                <IconPlayerSkipForwardFilled size={14} />
              </button>
            </div>

            <div class="player-title">
              <strong>{track().title}</strong>
              <span>norelock</span>
            </div>

            <span class="player-time">{formatTime(player.position())}</span>

            <div class="player-wave">
              <Waveform
                peaks={track().peaks}
                progress={progress()}
                active
                pending={!track().hasRealPeaks}
                onSeek={(r) => player.seekRatio(r)}
              />
            </div>

            <span class="player-time">{formatTime(total())}</span>

            <label class="player-volume">
              <IconVolume size={16} stroke-width={1.5} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={player.volume()}
                onInput={(event) => player.setVolume(Number(event.currentTarget.value))}
                aria-label="Volume"
              />
            </label>

            <a
              class="player-download"
              href={downloadHref(track())}
              onClick={() => noteDownload(track())}
              aria-label="Download MP3"
              target="_self"
              rel="external"
            >
              <IconDownload size={16} stroke-width={1.6} />
            </a>

            <button type="button" class="player-close" onClick={() => player.stop()} aria-label="Close player">
              <IconX size={16} stroke-width={1.6} />
            </button>
          </div>
        </div>
      )}
    </Show>
  );
}
