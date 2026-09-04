import { For, onMount } from 'solid-js';
import { IconArrowUpRight } from '@tabler/icons-solidjs';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { ReleaseGroup } from '@/components/music/ReleaseGroup';
import { releases } from '@/data/tracks';
import { loadDownloadCounts } from '@/lib/downloads';

export default function MusicPage() {
  onMount(() => {
    document.title = 'music — norelock.lol';
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

      <div class="release-list">
        <For each={releases}>{(release) => <ReleaseGroup release={release} />}</For>
      </div>

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
