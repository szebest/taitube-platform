import { tv } from '../../lib/class-names';
import type { LogoSize, LogoTone, LogoVariant } from './types';

export const logoStyles = tv({
  slots: {
    root: 'tw:inline-flex tw:shrink-0 tw:items-center tw:gap-[calc(var(--logo-mark)*0.36)] tw:text-fg',
    mark: 'tw:h-(--logo-mark) tw:w-auto tw:shrink-0',
    wordmark:
      'tw:font-sans tw:text-[calc(var(--logo-mark)*1.2)] tw:leading-none tw:font-extrabold tw:tracking-[-0.045em]',
  },
  variants: {
    variant: {
      lockup: {},
      mark: { wordmark: 'tw:hidden' },
      wordmark: { mark: 'tw:hidden' },
    } satisfies Record<LogoVariant, object>,
    size: {
      sm: { root: 'tw:[--logo-mark:20px]' },
      md: { root: 'tw:[--logo-mark:28px]' },
      lg: { root: 'tw:[--logo-mark:40px]' },
    } satisfies Record<LogoSize, object>,
    tone: {
      neutral: {},
      accent: { mark: 'tw:text-accent' },
    } satisfies Record<LogoTone, object>,
  },
  defaultVariants: { variant: 'lockup', size: 'md', tone: 'neutral' },
});
