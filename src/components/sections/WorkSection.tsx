import { For } from 'solid-js';
import { IconArrowUpRight } from '@tabler/icons-solidjs';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { projects } from '@/data/profile';

export function WorkSection() {
  return (
    <section id="work" class="site-shell section-space scroll-mt-24" data-reveal>
      <SectionHeading
        index="02"
        eyebrow="selected work"
        title={<>a few things keeping me<br /><span>busy.</span></>}
        copy={<>there's also a graveyard of side projects behind these. some got rewritten, some got rewritten again, some sit untouched on github for six months until i randomly remember they exist.</>}
      />

      <div class="project-list">
        <For each={projects}>
          {(project) => (
            <a class="project-row group" href={project.href} target="_blank" rel="noreferrer">
              <span class="project-index">{project.id}</span>
              <div class="project-name">
                <span>{project.type}</span>
                <h3>{project.title}</h3>
              </div>
              <p class="project-description">{project.description}</p>
              <div class="project-stack">
                <For each={project.stack}>{(tech) => <Badge variant="outline">{tech}</Badge>}</For>
              </div>
              <span class="project-arrow"><IconArrowUpRight size={24} stroke={1.3} /></span>
            </a>
          )}
        </For>
      </div>
    </section>
  );
}
