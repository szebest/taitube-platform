import type { ComponentPropsWithRef } from 'react';
import { badgeStyles } from './badge.variants';
import type { BadgeFill, BadgeSize, BadgeTone } from './types';

export interface BadgeProps extends ComponentPropsWithRef<'span'> {
  variant?: BadgeFill;
  tone?: BadgeTone;
  size?: BadgeSize;
}

/** A static label; a status tone says itself with its icon and word, `live` with a dot beside its word. */
export function Badge({ variant, tone, size, className, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={badgeStyles({ variant, tone, size, className })} {...props}>
      {tone === 'live' && (
        <span
          aria-hidden="true"
          className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-current"
        />
      )}
      {children}
    </span>
  );
}
