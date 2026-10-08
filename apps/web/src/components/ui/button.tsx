import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';

import { cn } from './cn';

const BASE =
  'tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-2 tw:rounded-full tw:border-0 tw:font-sans tw:font-medium tw:whitespace-nowrap tw:no-underline tw:transition-colors tw:focus-ring tw:disabled:pointer-events-none tw:disabled:opacity-50';

const VARIANTS = {
  primary: 'tw:bg-accent tw:text-on-accent tw:hover:bg-accent-hover',
  secondary: 'tw:bg-surface-elevated tw:text-fg tw:hover:bg-surface-hover',
  ghost: 'tw:bg-transparent tw:text-fg tw:hover:bg-surface-hover',
  destructive: 'tw:bg-danger tw:text-on-danger tw:hover:bg-danger-hover',
};

const SIZES = {
  sm: 'tw:h-8 tw:px-3 tw:text-sm',
  md: 'tw:h-9 tw:px-4 tw:text-sm',
  icon: 'tw:size-9',
};

export type ButtonVariant = keyof typeof VARIANTS;

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  /** Styles the one child element, a link for instance, instead of rendering a `<button>`. */
  asChild?: boolean;
} & ({ size?: 'sm' | 'md' } | { size: 'icon'; 'aria-label': string });

export function Button({
  variant = 'secondary',
  size = 'md',
  asChild = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (asChild) return <Slot className={classes} {...props} />;
  return <button type={type} className={classes} {...props} />;
}
