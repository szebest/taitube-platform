import { tv } from '@vp/ui';
import type { StatCardDeltaTone, StatCardSize, StatCardTrend } from './types';

export const STAT_CARD_TREND_TONE = {
  up: 'success',
  down: 'danger',
  flat: 'neutral',
} as const satisfies Record<StatCardTrend, StatCardDeltaTone>;

export const statCardStyles = tv({
  slots: {
    root: 'relative m-0 min-w-0 [a&]:pe-[calc(var(--inset-card)+var(--size-icon-md))] [a&,button&]:hover:shadow-1',
    figure: 'm-0 flex min-w-0 flex-col gap-inline',
    label: 'm-0 text-body-sm text-fg-muted',
    value: 'm-0 text-title-lg tabular-nums text-fg',
    placeholder: 'm-0 text-body text-fg-muted',
    delta: 'self-start animate-fade-in',
    spark: 'hidden w-full overflow-visible medium:block',
    chevron: 'absolute end-inset-card top-inset-card text-fg-muted',
  },
  variants: {
    size: {
      md: { root: 'min-h-[10rem]', spark: 'h-[2rem]' },
      lg: { root: 'min-h-[12rem]', value: 'medium:text-headline', spark: 'h-[3rem]' },
    } satisfies Record<StatCardSize, object>,
  },
  defaultVariants: { size: 'md' },
});
