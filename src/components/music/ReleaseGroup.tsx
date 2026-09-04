import { For, Show } from 'solid-js';
import { IconPlayerPlayFilled } from '@tabler/icons-solidjs';
import { CoverArt } from '@/components/music/CoverArt';
import { TrackRow } from '@/components/music/TrackRow';
import type { Release } from '@/lib/catalog';
import { formatTime, player } from '@/lib/player';

export function ReleaseGroup(props: { release: Release }) {
  const runtime = () => props.release.tracks.reduce((total, track) => total + track.duration, 0);
  const isAlbum = () => Boolean(props.release.album);

  return (
    <section class="release" data-reveal>
      <header class="release-head">
        <Show when={isAlbum()}>
          <div class="release-cover">
            <CoverArt src={props.release.cover} size={112} />
          </div>
        </Show>

        <div class="release-meta">
          <span class="release-kind">{isAlbum() ? 'album' : 'singles'}</span>
          <h2>{props.release.title}</h2>
          <p>
            {props.release.year} · {props.release.tracks.length}{' '}
            {props.release.tracks.length === 1 ? 'track' : 'tracks'} · {formatTime(runtime())}
          </p>
        </div>

        <button
          type="button"
          class="release-play"
          onClick={() => void player.play(props.release.tracks[0], props.release.tracks)}
        >
          <IconPlayerPlayFilled size={15} />
          play {isAlbum() ? 'album' : 'all'}
        </button>
      </header>

      <div class="track-list">
        <For each={props.release.tracks}>
          {(track) => <TrackRow track={track} queue={props.release.tracks} />}
        </For>
      </div>
    </section>
  );
}
