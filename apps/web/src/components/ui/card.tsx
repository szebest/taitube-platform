import type { ComponentProps } from 'react';
import { cn } from 'tailwind-variants';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-border tw:bg-surface-elevated tw:p-4 tw:font-sans tw:text-fg',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('tw:flex tw:flex-col tw:gap-1', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('tw:m-0 tw:text-base tw:font-medium', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('tw:m-0 tw:text-sm tw:text-fg-muted', className)}
      {...props}
    />
  );
}

export function CardContent(props: ComponentProps<'div'>) {
  return <div data-slot="card-content" {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('tw:flex tw:items-center tw:gap-2', className)}
      {...props}
    />
  );
}
