import { splitProps, type ComponentProps } from 'solid-js';
import { cn } from '@/lib/utils';

type SeparatorProps = ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical';
};

export function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ['class', 'orientation']);
  const orientation = local.orientation ?? 'horizontal';

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      class={cn(
        'shrink-0 bg-[var(--border)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        local.class,
      )}
      {...rest}
    />
  );
}
