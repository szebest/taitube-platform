import { cn } from './cn';

/** A placeholder block; its size comes from `className`, to match the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('tw:rounded-md tw:bg-surface-hover tw:motion-safe:animate-shimmer', className)}
    />
  );
}
