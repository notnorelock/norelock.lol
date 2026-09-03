import { Tooltip as KTooltip } from '@kobalte/core/tooltip';
import { splitProps, type ComponentProps } from 'solid-js';
import { cn } from '@/lib/utils';

export const Tooltip = KTooltip;
export const TooltipTrigger = KTooltip.Trigger;

export function TooltipContent(props: ComponentProps<typeof KTooltip.Content>) {
  const [local, rest] = splitProps(props, ['class', 'children']);

  return (
    <KTooltip.Portal>
      <KTooltip.Content
        class={cn(
          'z-50 border border-[var(--border-strong)] bg-[#0c0a0f]/95 px-3 py-2 text-xs text-[var(--foreground)] shadow-2xl backdrop-blur-md',
          'origin-[var(--kb-tooltip-content-transform-origin)]',
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </KTooltip.Content>
    </KTooltip.Portal>
  );
}
