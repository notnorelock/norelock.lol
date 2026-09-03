import { For } from 'solid-js';
import { IconArrowUpRight } from '@tabler/icons-solidjs';
import { BrandIcon } from '@/components/shared/BrandIcon';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { SpotlightCard } from '@/components/shared/SpotlightCard';
import { socialLinks } from '@/data/profile';

export function LinksSection() {
  return (
    <section id="links" class="site-shell section-space scroll-mt-24 pb-36" data-reveal>
      <SectionHeading
        index="03"
        eyebrow="elsewhere"
        title={<>enough portfolio.<br /><span>here are the links.</span></>}
        copy={<>right now i'm mostly bouncing between music, vanta, borealise and whatever new idea hijacks my brain that week.</>}
      />

      <div class="social-grid">
        <For each={socialLinks}>
          {(link, index) => (
            <a href={link.href} target="_blank" rel="noreferrer" class="social-link group">
              <SpotlightCard class="social-card">
                <div class="social-icon"><BrandIcon icon={link.icon} /></div>
                <div>
                  <span class="social-index">0{index() + 1}</span>
                  <h3>{link.label}</h3>
                  <p>{link.note}</p>
                </div>
                <IconArrowUpRight size={21} class="social-arrow" />
              </SpotlightCard>
            </a>
          )}
        </For>
      </div>

      <div class="outro-block">
        <p>still here?</p>
        <h2>cool. go build something weird.</h2>
        <a href="https://github.com/notnorelock" target="_blank" rel="noreferrer">github.com/notnorelock <IconArrowUpRight size={18} /></a>
      </div>
    </section>
  );
}
