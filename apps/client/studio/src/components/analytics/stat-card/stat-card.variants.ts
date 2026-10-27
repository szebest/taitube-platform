import { tv } from '@vp/ui';
import type { StatCardDeltaTone, StatCardSize, StatCardTrend } from './types';

export const STAT_CARD_TREND_TONE = {
  up: 'success',
  down: 'danger',
  flat: 'neutral',
} as const satisfies Record<StatCardTrend, StatCardDeltaTone>;

export const statCardStyles = tv({
  slots: {
    root: 'tw:relative tw:m-0 tw:min-w-0 tw:[a&]:pe-[calc(var(--inset-card)+var(--size-icon-md))] tw:[a&,button&]:hover:shadow-1',
    figure: 'tw:m-0 tw:flex tw:min-w-0 tw:flex-col tw:gap-inline',
    label: 'tw:m-0 tw:text-body-sm tw:text-fg-muted',
    value: 'tw:m-0 tw:text-title-lg tw:tabular-nums tw:text-fg',
    placeholder: 'tw:m-0 tw:text-body tw:text-fg-muted',
    delta: 'tw:self-start tw:animate-fade-in',
    spark: 'tw:hidden tw:w-full tw:overflow-visible tw:medium:block',
    chevron: 'tw:absolute tw:end-inset-card tw:top-inset-card tw:text-fg-muted',
  },
  variants: {
    size: {
      md: { root: 'tw:min-h-[10rem]', spark: 'tw:h-[2rem]' },
      lg: { root: 'tw:min-h-[12rem]', value: 'tw:medium:text-headline', spark: 'tw:h-[3rem]' },
    } satisfies Record<StatCardSize, object>,
  },
  defaultVariants: { size: 'md' },
});
