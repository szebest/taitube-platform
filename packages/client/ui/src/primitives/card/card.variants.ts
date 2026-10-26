import { tv } from '../../lib/class-names';
import type { CardElevation, CardFill, CardSize } from './types';

export const cardStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-col tw:rounded-card tw:font-sans tw:text-fg tw:no-underline tw:transition-shadow tw:duration-slow tw:ease-settle tw:motion-reduce:transition-none tw:[a&,button&]:cursor-pointer tw:[a&,button&]:text-start tw:[a&,button&]:focus-ring tw:[a&,button&]:hover:shadow-2',
    header: 'tw:grid tw:grid-cols-[1fr_auto] tw:items-start tw:gap-x-stack',
    title: 'tw:col-start-1 tw:m-0 tw:text-title',
    description: 'tw:col-start-1 tw:m-0 tw:text-body-sm tw:text-fg-muted',
    action: 'tw:col-start-2 tw:row-span-2 tw:row-start-1 tw:self-center',
    body: '',
    footer: 'tw:flex tw:items-center tw:justify-end tw:gap-inline',
  },
  variants: {
    variant: {
      solid: { root: 'tw:border-divider tw:border-border tw:bg-surface' },
      outline: { root: 'tw:border-control tw:border-border-strong tw:bg-transparent' },
      ghost: { root: 'tw:bg-transparent' },
    } satisfies Record<CardFill, object>,
    elevation: {
      1: { root: 'tw:shadow-1' },
      2: { root: 'tw:bg-raised tw:shadow-2' },
      3: { root: 'tw:bg-raised tw:shadow-3' },
    } satisfies Record<CardElevation, object>,
    size: {
      sm: { root: 'tw:gap-inline tw:p-inset-control', header: 'tw:gap-y-1' },
      md: { root: 'tw:gap-stack tw:p-inset-card', header: 'tw:gap-y-inline' },
    } satisfies Record<CardSize, object>,
  },
  defaultVariants: { variant: 'solid', size: 'md' },
});
