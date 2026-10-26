import type { ComponentPropsWithRef } from 'react';
import { logoStyles } from './logo.variants';
import type { LogoSize, LogoTone, LogoVariant } from './types';

const BRAND = 'Taitube';

export interface LogoProps extends ComponentPropsWithRef<'span'> {
  variant?: LogoVariant;
  size?: LogoSize;
  tone?: LogoTone;
}

/** The mark (a 16:9 frame with a rising sun) and the live-text wordmark; `aria-hidden` inside a named home link. */
export function Logo({ variant, size, tone, className, ...props }: LogoProps) {
  const styles = logoStyles({ variant, size, tone });

  return (
    <span
      data-slot="logo"
      role="img"
      aria-label={BRAND}
      className={styles.root({ className })}
      {...props}
    >
      <svg viewBox="0 0 32 22" fill="none" aria-hidden="true" className={styles.mark()}>
        <rect x="1.5" y="1.5" width="29" height="19" rx="6" stroke="currentColor" strokeWidth="3" />
        <path d="M10 19.5a6 6 0 0 1 12 0z" fill="currentColor" />
      </svg>
      <span aria-hidden="true" className={styles.wordmark()}>
        taitube
      </span>
    </span>
  );
}
