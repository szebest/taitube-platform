import type { ComponentPropsWithRef } from 'react';
import { accentRingStyles } from './accent-ring.variants';
import type { AccentRingAccent } from './types';

export interface AccentRingProps extends ComponentPropsWithRef<'span'> {
  accent: AccentRingAccent;
}

/** The ring in an identity's accent around its avatar, so the header always says who is browsing. */
export function AccentRing({ accent, className, ...props }: AccentRingProps) {
  return (
    <span
      data-slot="accent-ring"
      data-accent={accent}
      className={accentRingStyles({ accent, className })}
      {...props}
    />
  );
}
