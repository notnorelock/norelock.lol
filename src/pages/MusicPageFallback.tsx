import { SectionHeading } from '@/components/shared/SectionHeading';
import { TrackRowSkeleton } from '@/components/music/TrackRowSkeleton';

/** Shown while the lazily-loaded music chunk is still in flight. */
export function MusicPageFallback() {
  return (
    <section class="site-shell section-space music-page">
      <SectionHeading
        index="01"
        eyebrow="music"
        title={<>everything i<br /><span>actually finished.</span></>}
        copy={<>play them here or grab the mp3. all 320 kbps, no signup, no email, nothing.</>}
      />
      <TrackRowSkeleton rows={5} />
    </section>
  );
}
