import { createMemo, For, onMount, Show } from 'solid-js';
import { IconArrowUpRight } from '@tabler/icons-solidjs';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { ReleaseGroup } from '@/components/music/ReleaseGroup';
import { TrackRowSkeleton } from '@/components/music/TrackRowSkeleton';
import { allTracks, catalogFailed, catalogLoaded, groupReleases, loadCatalog } from '@/lib/catalog';
import { loadDownloadCounts } from '@/lib/downloads';

export default function MusicPage() {
  const releases = createMemo(() => groupReleases(allTracks()));

  onMount(() => {
    document.title = 'music — norelock.lol';
    void loadCatalog();
    void loadDownloadCounts();
  });

  return (
    <section id="music" class="site-shell section-space music-page" data-reveal>
      <SectionHeading
        index="01"
        eyebrow="music"
        title={<>everything i<br /><span>actually finished.</span></>}
        copy={<>play them here or grab the mp3. all 320 kbps, no signup, no email, nothing. if you use one in a video just credit me somewhere.</>}
      />

      <Show when={catalogLoaded()} fallback={<TrackRowSkeleton rows={5} />}>
        <Show
          when={releases().length}
          fallback={
            <p class="music-empty">
              {catalogFailed() ? "couldn't load the tracks. try a refresh?" : 'nothing here yet.'}
            </p>
          }
        >
          <div class="release-list">
            <For each={releases()}>{(release) => <ReleaseGroup release={release} />}</For>
          </div>
        </Show>
      </Show>

      <div class="music-outro">
        <p>the rest lives on streaming.</p>
        <div class="music-outro-links">
          <a href="https://open.spotify.com/artist/02OqjxI5pv8HGiGQqNt38b" target="_blank" rel="noreferrer">
            spotify <IconArrowUpRight size={15} />
          </a>
          <a href="https://soundcloud.com/norelock/tracks" target="_blank" rel="noreferrer">
            soundcloud <IconArrowUpRight size={15} />
          </a>
          <a href="https://norelock.bandcamp.com/" target="_blank" rel="noreferrer">
            bandcamp <IconArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
