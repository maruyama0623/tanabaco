import clsx from 'clsx';
import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  size?: Size;
}

export function Button({
  variant = 'primary',
  block,
  size = 'md',
  className,
  children,
  ...rest
}: Props) {
  const base =
    'rounded-md px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes: Record<Size, string> = {
    md: 'px-4 py-3 text-sm',
    sm: 'px-3 py-2 text-xs',
  };
  const colorMap: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-secondary text-white hover:bg-secondary/90',
    ghost: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  };
  return (
    <button
      className={clsx(base, sizes[size], colorMap[variant], block && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
