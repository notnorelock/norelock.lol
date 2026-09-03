import { splitProps, type ComponentProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.68rem] font-medium leading-none tracking-[0.04em]',
  {
    variants: {
      variant: {
        default: 'border-[var(--primary-border)] bg-[var(--primary-muted)] text-[var(--primary-soft)]',
        outline: 'border-[var(--border)] bg-transparent text-[var(--muted-foreground)]',
        quiet: 'border-transparent bg-[var(--panel)] text-[var(--muted-foreground)]',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ['class', 'variant']);
  return <span class={cn(badgeVariants({ variant: local.variant }), local.class)} {...rest} />;
}
