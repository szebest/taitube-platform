import { useState } from 'react';

import { cn } from './cn';

const SIZES = {
  sm: 'tw:size-6 tw:text-xs',
  md: 'tw:size-9 tw:text-sm',
  lg: 'tw:size-20 tw:text-2xl',
};

export type AvatarProps = {
  /** Names the picture for assistive technology and gives the monogram its letter. */
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

function monogram(name: string): string {
  const [first = ''] = Array.from(name.trim());
  return first.toUpperCase();
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const classes = cn(
    'tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:bg-surface-hover tw:font-sans tw:font-medium tw:text-fg tw:select-none',
    SIZES[size],
    className
  );

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailedSrc(src)}
        className={cn(classes, 'tw:object-cover')}
      />
    );
  }
  return (
    <span role="img" aria-label={name} className={classes}>
      {monogram(name)}
    </span>
  );
}
