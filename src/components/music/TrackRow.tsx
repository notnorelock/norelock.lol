import { Show } from 'solid-js';
import { IconDownload, IconLoader2, IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-solidjs';
import { CoverArt } from '@/components/music/CoverArt';
import { Waveform } from '@/components/music/Waveform';
import type { Track } from '@/data/tracks';
import { formatTime, player } from '@/lib/player';
import { downloadCounts, downloadHref, formatCount, noteDownload } from '@/lib/downloads';

export function TrackRow(props: { track: Track; queue?: Track[] }) {
  const isCurrent = () => player.isCurrent(props.track);
  const isPlaying = () => isCurrent() && player.playing();
  const total = () => (isCurrent() ? player.duration() || props.track.duration : props.track.duration);
  const progress = () => (isCurrent() && total() ? player.position() / total() : 0);

  return (
    <article class="track-row" classList={{ 'is-current': isCurrent() }}>
      <div class="track-cover">
        <CoverArt src={props.track.cover} size={72} />
        <button
          type="button"
          class="track-play"
          onClick={() => player.toggle(props.track, props.queue)}
          aria-label={isPlaying() ? `Pause ${props.track.title}` : `Play ${props.track.title}`}
        >
          <Show
            when={!(isCurrent() && player.loading())}
            fallback={<IconLoader2 size={20} class="track-spin" />}
          >
            <Show when={isPlaying()} fallback={<IconPlayerPlayFilled size={19} />}>
              <IconPlayerPauseFilled size={19} />
            </Show>
          </Show>
        </button>
      </div>

      <div class="track-body">
        <div class="track-head">
          <div class="track-title">
            <h3>{props.track.title}</h3>
            <Show when={props.track.subtitle}>
              <span>{props.track.subtitle}</span>
            </Show>
          </div>
          <div class="track-meta">
            <span>{props.track.year}</span>
            <span class="track-time">
              {isCurrent() ? formatTime(player.position()) : '0:00'} / {formatTime(total())}
            </span>
          </div>
        </div>

        <Waveform
          peaks={props.track.peaks}
          progress={progress()}
          active={isCurrent()}
          pending={!props.track.hasRealPeaks}
          onSeek={(ratio) => {
            if (!isCurrent()) {
              void player.play(props.track, props.queue).then(() => player.seekRatio(ratio));
              return;
            }
            player.seekRatio(ratio);
          }}
        />

        <Show when={isCurrent() && player.failed()}>
          <p class="track-error">couldn't load this one. the file might not be uploaded yet.</p>
        </Show>
      </div>

      <Show when={props.track.downloadable !== false}>
        <a
          class="track-download"
          href={downloadHref(props.track)}
          onClick={() => noteDownload(props.track)}
          aria-label={`Download ${props.track.title} as MP3`}
          target="_self"
          rel="external"
        >
          <IconDownload size={17} stroke={1.6} />
          <span class="track-downloads">{formatCount(downloadCounts()[props.track.id] ?? 0)}</span>
        </a>
      </Show>
    </article>
  );
}
