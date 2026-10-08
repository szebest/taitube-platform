import type { ComponentProps } from 'react';

import { cn } from './cn';

const VARIANTS = {
  neutral: 'tw:bg-surface-hover tw:text-fg',
  accent: 'tw:bg-accent tw:text-on-accent',
  success: 'tw:border-success tw:text-success',
  warning: 'tw:border-warning tw:text-warning',
  danger: 'tw:border-danger tw:text-danger',
};

export type BadgeVariant = keyof typeof VARIANTS;

export type BadgeProps = ComponentProps<'span'> & { variant?: BadgeVariant };

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'tw:inline-flex tw:items-center tw:rounded-sm tw:border tw:border-transparent tw:px-1.5 tw:py-0.5 tw:font-sans tw:text-xs tw:font-medium tw:whitespace-nowrap',
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
