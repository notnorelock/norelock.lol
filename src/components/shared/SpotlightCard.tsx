import { splitProps, type ComponentProps, type JSX } from 'solid-js';
import { cn } from '@/lib/utils';

type Props = ComponentProps<'div'>;

export function SpotlightCard(props: Props) {
  const [local, rest] = splitProps(props, ['class', 'onPointerMove']);

  const handlePointerMove: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);

    if (typeof local.onPointerMove === 'function') {
      local.onPointerMove(event);
    }
  };

  return (
    <div
      class={cn('spotlight-card', local.class)}
      onPointerMove={handlePointerMove}
      {...rest}
    />
  );
}
