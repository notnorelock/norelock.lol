import { For } from 'solid-js';
import { IconArrowRight } from '@tabler/icons-solidjs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { SpotlightCard } from '@/components/shared/SpotlightCard';
import { capabilityCards, disciplines, profile } from '@/data/profile';

export function AboutSection() {
  return (
    <section id="about" class="site-shell section-space scroll-mt-24" data-reveal>
      <SectionHeading
        index="01"
        eyebrow="about"
        title={<>hey, i'm norelock.<br /><span>i make things. then i break them.</span></>}
        copy={<>breaking them is important too. i don't want my entire personality to be “software engineer” — i just happen to really like making things.</>}
      />

      <div class="about-layout">
        <div class="about-copy">
          <For each={profile.about}>{(paragraph) => <p>{paragraph}</p>}</For>
        </div>

        <Tabs defaultValue="web" class="discipline-tabs">
          <TabsList>
            <For each={disciplines}>{(item) => <TabsTrigger value={item.value}>{item.value}</TabsTrigger>}</For>
          </TabsList>
          <For each={disciplines}>
            {(item) => (
              <TabsContent value={item.value}>
                <SpotlightCard class="discipline-panel">
                  <div class="discipline-panel-head">
                    <div>
                      <p>{item.eyebrow}</p>
                      <h3>{item.title}</h3>
                    </div>
                    <item.icon size={32} stroke={1.25} />
                  </div>
                  <p class="discipline-copy">{item.copy}</p>
                  <div class="discipline-stack">
                    <For each={item.stack}>{(tech) => <Badge variant="outline">{tech}</Badge>}</For>
                  </div>
                </SpotlightCard>
              </TabsContent>
            )}
          </For>
        </Tabs>
      </div>

      <div class="capability-grid">
        <For each={capabilityCards}>
          {(item, index) => (
            <SpotlightCard>
              <Card class="capability-card group">
                <CardHeader class="capability-head">
                  <span class="capability-index">0{index() + 1}</span>
                  <item.icon size={24} stroke={1.3} />
                </CardHeader>
                <CardContent class="capability-content">
                  <CardTitle>{item.title}</CardTitle>
                  <p>{item.text}</p>
                  <IconArrowRight size={18} stroke={1.4} class="capability-arrow" />
                </CardContent>
              </Card>
            </SpotlightCard>
          )}
        </For>
      </div>
    </section>
  );
}
