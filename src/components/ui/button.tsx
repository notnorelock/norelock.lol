import { splitProps, type ComponentProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border text-sm font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        default:
          'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-strong)] hover:border-[var(--primary-strong)]',
        outline:
          'border-[var(--border-strong)] bg-[var(--panel)] text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary-muted)]',
        ghost:
          'border-transparent bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--panel)] hover:text-[var(--foreground)]',
        link:
          'border-transparent bg-transparent px-0 text-[var(--foreground)] underline-offset-4 hover:text-[var(--primary)] hover:underline',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-5 text-[0.95rem]',
        icon: 'size-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size', 'type']);

  return (
    <button
      type={local.type ?? 'button'}
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  );
}
