import type { JSX } from 'solid-js';

interface Props {
  eyebrow: string;
  title: JSX.Element;
  copy?: JSX.Element;
  index?: string;
}

export function SectionHeading(props: Props) {
  return (
    <div class="section-heading mb-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] lg:items-end lg:gap-12">
      <div>
        <div class="mb-4 flex items-center gap-3 font-mono text-[0.68rem] lowercase tracking-[0.12em] text-[var(--primary-soft)]">
          {props.index && <span class="text-[var(--muted-foreground)]">[{props.index}]</span>}
          <span>{props.eyebrow}</span>
        </div>
        <h2 class="section-title">{props.title}</h2>
      </div>
      {props.copy && <p class="section-copy">{props.copy}</p>}
    </div>
  );
}
