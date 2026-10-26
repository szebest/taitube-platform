import { tv } from '../../lib/class-names';
import { variantNames } from '../../lib/variant-names';
import type { BadgeFill, BadgeSize, BadgeTone } from './types';

const LIVE = 'tw:border-transparent tw:bg-live tw:text-on-live';

const FILL_TONES = {
  solid: {
    neutral: 'tw:bg-fg tw:text-bg',
    accent: 'tw:bg-accent tw:text-on-accent',
    success: 'tw:bg-tint tw:text-success-ink',
    warning: 'tw:bg-tint tw:text-warning-ink',
    danger: 'tw:bg-danger tw:text-on-live',
    info: 'tw:bg-tint tw:text-info-ink',
    live: LIVE,
  },
  soft: {
    neutral: 'tw:bg-tint-strong tw:text-fg',
    accent: 'tw:bg-accent-soft tw:text-accent-ink',
    success: 'tw:bg-tint tw:text-success-ink',
    warning: 'tw:bg-tint tw:text-warning-ink',
    danger: 'tw:bg-tint tw:text-danger-ink',
    info: 'tw:bg-tint tw:text-info-ink',
    live: LIVE,
  },
  outline: {
    neutral: 'tw:text-fg',
    accent: 'tw:border-accent tw:text-accent-ink',
    success: 'tw:text-success-ink',
    warning: 'tw:text-warning-ink',
    danger: 'tw:text-danger-ink',
    info: 'tw:text-info-ink',
    live: LIVE,
  },
  scrim: {
    neutral: 'tw:bg-scrim tw:text-on-live',
    accent: 'tw:bg-scrim tw:text-on-live',
    success: 'tw:bg-scrim tw:text-on-live',
    warning: 'tw:bg-scrim tw:text-on-live',
    danger: 'tw:bg-scrim tw:text-on-live',
    info: 'tw:bg-scrim tw:text-on-live',
    live: LIVE,
  },
} satisfies Record<BadgeFill, Record<BadgeTone, string>>;

export const badgeStyles = tv({
  base: 'tw:inline-flex tw:max-w-full tw:items-center tw:gap-inline tw:overflow-hidden tw:rounded-xs tw:border-control tw:border-transparent tw:px-1.5 tw:py-px tw:font-sans tw:whitespace-nowrap tw:tabular-nums tw:[&_svg]:size-icon-sm tw:[&_svg]:shrink-0',
  variants: {
    variant: {
      solid: '',
      soft: '',
      outline: 'tw:border-border-strong tw:bg-transparent',
      scrim: '',
    } satisfies Record<BadgeFill, string>,
    tone: {
      neutral: '',
      accent: '',
      success: '',
      warning: '',
      danger: '',
      info: '',
      live: '',
    } satisfies Record<BadgeTone, string>,
    size: {
      sm: 'tw:text-caption',
      md: 'tw:text-overline tw:uppercase',
    } satisfies Record<BadgeSize, string>,
  },
  compoundVariants: variantNames(FILL_TONES).flatMap((variant) =>
    variantNames(FILL_TONES[variant]).map((tone) => ({
      variant,
      tone,
      class: FILL_TONES[variant][tone],
    }))
  ),
  defaultVariants: { variant: 'soft', tone: 'neutral', size: 'md' },
});
