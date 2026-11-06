import { tv } from '../../lib/class-names';
import { variantNames } from '../../lib/variant-names';
import type { BadgeFill, BadgeSize, BadgeTone } from './types';

const LIVE = 'border-transparent bg-live text-on-live';

const FILL_TONES = {
  solid: {
    neutral: 'bg-fg text-bg',
    accent: 'bg-accent text-on-accent',
    success: 'bg-tint text-success-ink',
    warning: 'bg-tint text-warning-ink',
    danger: 'bg-danger text-on-live',
    info: 'bg-tint text-info-ink',
    live: LIVE,
  },
  soft: {
    neutral: 'bg-tint-strong text-fg',
    accent: 'bg-accent-soft text-accent-ink',
    success: 'bg-tint text-success-ink',
    warning: 'bg-tint text-warning-ink',
    danger: 'bg-tint text-danger-ink',
    info: 'bg-tint text-info-ink',
    live: LIVE,
  },
  outline: {
    neutral: 'text-fg',
    accent: 'border-accent text-accent-ink',
    success: 'text-success-ink',
    warning: 'text-warning-ink',
    danger: 'text-danger-ink',
    info: 'text-info-ink',
    live: LIVE,
  },
  scrim: {
    neutral: 'bg-scrim text-on-live',
    accent: 'bg-scrim text-on-live',
    success: 'bg-scrim text-on-live',
    warning: 'bg-scrim text-on-live',
    danger: 'bg-scrim text-on-live',
    info: 'bg-scrim text-on-live',
    live: LIVE,
  },
} satisfies Record<BadgeFill, Record<BadgeTone, string>>;

export const badgeStyles = tv({
  base: 'inline-flex max-w-full items-center gap-inline overflow-hidden rounded-xs border-control border-transparent px-1.5 py-px font-sans whitespace-nowrap tabular-nums [&_svg]:size-icon-sm [&_svg]:shrink-0',
  variants: {
    variant: {
      solid: '',
      soft: '',
      outline: 'border-border-strong bg-transparent',
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
      sm: 'text-caption',
      md: 'text-overline uppercase',
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
