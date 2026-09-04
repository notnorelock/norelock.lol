import { lazy, Suspense } from 'solid-js';
import { IconArrowDown, IconArrowUpRight, IconCalendarEvent } from '@tabler/icons-solidjs';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { profile } from '@/data/profile';
import { getBirthdayStats } from '@/lib/date';
import { cn } from '@/lib/utils';

const GlitchPortrait = lazy(() => import('@/components/visuals/GlitchPortrait'));

export function HeroSection() {
  const birthday = getBirthdayStats();

  return (
    <section id="top" class="hero-section">
      <div class="site-shell hero-shell">
        <div class="hero-copy" data-reveal>
          <div class="hero-kicker">
            <span class="hero-hash">0x4e4f52454c4f434b</span>
          </div>

          <div class="hero-title-wrap">
            <span class="hero-title-ghost" aria-hidden="true">norelock</span>
            <h1 class="hero-name" data-text="norelock">norelock</h1>
          </div>

          <p class="hero-role">{profile.role}</p>
          <p class="hero-intro">{profile.intro}</p>

          <div class="hero-meta">
            <span><strong>{birthday.age}</strong> years old</span>
            <Separator orientation="vertical" class="hero-meta-separator" />
            <span><IconCalendarEvent size={14} stroke-width={1.55} /> born {profile.birthday}</span>
            <Separator orientation="vertical" class="hero-meta-separator" />
            <span>{birthday.daysUntilBirthday} days to the next one</span>
          </div>

          <div class="hero-actions-row">
            <a href="#work" class={cn(buttonVariants({ size: 'lg' }), 'hero-primary group')}>
              selected work <IconArrowDown size={17} stroke-width={1.6} class="transition-transform group-hover:translate-y-0.5" />
            </a>
            <a href="https://github.com/notnorelock" target="_blank" rel="noreferrer" class={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'group')}>
              github <IconArrowUpRight size={17} stroke-width={1.6} class="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        <div class="hero-visual" data-reveal>
          <div class="hero-orbits" aria-hidden="true"><i /><i /><i /></div>
          <div class="portrait-frame">
            <div class="portrait-aspect">
              <Suspense>
                <GlitchPortrait />
              </Suspense>
              <div class="portrait-scan" aria-hidden="true" />
              <div class="portrait-corners" aria-hidden="true"><i /><i /><i /><i /></div>
            </div>
          </div>
        </div>
      </div>  
    </section>
  );
}
