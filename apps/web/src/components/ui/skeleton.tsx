import type { ComponentProps } from 'react';
import { cn } from 'tailwind-variants';

/** A placeholder block; its size comes from `className`, to match the content it stands in for. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('tw:rounded-md tw:bg-tint tw:motion-safe:animate-shimmer', className)}
      {...props}
    />
  );
}
