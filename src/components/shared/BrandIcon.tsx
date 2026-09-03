import type { SimpleIcon } from 'simple-icons';

interface BrandIconProps {
  icon: SimpleIcon;
  size?: number;
  class?: string;
  title?: string;
}

export function BrandIcon(props: BrandIconProps) {
  const size = () => props.size ?? 22;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size()}
      height={size()}
      class={props.class}
      fill="currentColor"
      role={props.title ? 'img' : 'presentation'}
      aria-hidden={props.title ? undefined : 'true'}
    >
      {props.title && <title>{props.title}</title>}
      <path d={props.icon.path} />
    </svg>
  );
}
