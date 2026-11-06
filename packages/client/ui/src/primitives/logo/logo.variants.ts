import { tv } from '../../lib/class-names';
import type { LogoSize, LogoTone, LogoVariant } from './types';

export const logoStyles = tv({
  slots: {
    root: 'inline-flex shrink-0 items-center gap-[calc(var(--logo-mark)*0.36)] text-fg',
    mark: 'h-(--logo-mark) w-auto shrink-0',
    wordmark:
      'font-sans text-[calc(var(--logo-mark)*1.2)] leading-none font-(weight:--type-display-weight) tracking-[-0.045em]',
  },
  variants: {
    variant: {
      lockup: {},
      mark: { wordmark: 'hidden' },
      wordmark: { mark: 'hidden' },
    } satisfies Record<LogoVariant, object>,
    size: {
      sm: { root: '[--logo-mark:20px]' },
      md: { root: '[--logo-mark:28px]' },
      lg: { root: '[--logo-mark:40px]' },
    } satisfies Record<LogoSize, object>,
    tone: {
      neutral: {},
      accent: { mark: 'text-accent' },
    } satisfies Record<LogoTone, object>,
  },
  defaultVariants: { variant: 'lockup', size: 'md', tone: 'neutral' },
});
