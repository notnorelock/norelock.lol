import { Tabs as KTabs } from '@kobalte/core/tabs';
import { splitProps, type ComponentProps } from 'solid-js';
import { cn } from '@/lib/utils';

export const Tabs = KTabs;

export function TabsList(props: ComponentProps<typeof KTabs.List>) {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <KTabs.List
      class={cn(
        'relative inline-flex flex-wrap items-center gap-1 border border-[var(--border)] bg-[rgba(9,8,11,.62)] p-1 backdrop-blur-md',
        local.class,
      )}
      {...rest}
    />
  );
}

export function TabsTrigger(props: ComponentProps<typeof KTabs.Trigger>) {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <KTabs.Trigger
      class={cn(
        'relative min-h-9 px-3 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted-foreground)] transition-colors outline-none',
        'data-[selected]:bg-[var(--foreground)] data-[selected]:text-[var(--background)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        local.class,
      )}
      {...rest}
    />
  );
}

export function TabsContent(props: ComponentProps<typeof KTabs.Content>) {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <KTabs.Content
      class={cn('mt-5 outline-none data-[closed]:hidden', local.class)}
      {...rest}
    />
  );
}
