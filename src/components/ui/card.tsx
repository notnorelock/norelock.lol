import { splitProps, type ComponentProps } from 'solid-js';
import { cn } from '@/lib/utils';

export function Card(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <div
      class={cn(
        'border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] backdrop-blur-sm',
        local.class,
      )}
      {...rest}
    />
  );
}

export function CardHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('flex flex-col gap-2 p-5', local.class)} {...rest} />;
}

export function CardTitle(props: ComponentProps<'h3'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <h3 class={cn('text-lg font-semibold tracking-[-0.025em]', local.class)} {...rest} />;
}

export function CardDescription(props: ComponentProps<'p'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <p class={cn('text-sm leading-6 text-[var(--muted-foreground)]', local.class)} {...rest} />;
}

export function CardContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('p-5 pt-0', local.class)} {...rest} />;
}

export function CardFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('flex items-center p-5 pt-0', local.class)} {...rest} />;
}
