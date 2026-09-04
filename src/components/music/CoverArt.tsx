import { createSignal, Show } from 'solid-js';
import { IconMusic } from '@tabler/icons-solidjs';

interface Props {
  src: string;
  alt?: string;
  size: number;
  /** Skip the fade-in for covers that are already cached. */
  eager?: boolean;
  class?: string;
}

/**
 * Cover image with its own shimmer placeholder and a fallback tile, so a slow
 * or missing file never leaves a blank square in the row.
 */
export function CoverArt(props: Props) {
  const [state, setState] = createSignal<'loading' | 'ready' | 'error'>('loading');

  return (
    <div class={`cover-art ${props.class ?? ''}`} data-state={state()}>
      <Show when={state() === 'loading'}>
        <div class="cover-skeleton skeleton" aria-hidden="true" />
      </Show>

      <Show when={state() === 'error'}>
        <div class="cover-fallback" aria-hidden="true">
          <IconMusic size={Math.round(props.size * 0.34)} stroke={1.3} />
        </div>
      </Show>

      <img
        src={props.src}
        alt={props.alt ?? ''}
        width={props.size}
        height={props.size}
        loading={props.eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
    </div>
  );
}
