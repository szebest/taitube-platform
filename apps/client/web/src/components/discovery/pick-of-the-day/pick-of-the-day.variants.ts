import { tv } from '@vp/ui';
import type { PickOfTheDayLayoutStyle } from './types';

export const pickOfTheDayStyles = tv({
  slots: {
    root: 'tw:relative tw:isolate tw:animate-fade-in tw:rounded-card tw:p-inset-card tw:before:absolute tw:before:inset-0 tw:before:-z-1 tw:before:rounded-card tw:before:bg-surface tw:font-sans tw:text-fg tw:[animation-duration:var(--duration-base)] tw:medium:[&_[data-slot=video-card-thumb]]:max-w-[30rem] tw:expanded:[&_[data-slot=video-card-thumb]]:max-w-[40rem]',
    glow: 'tw:pointer-events-none tw:absolute tw:inset-y-0 tw:start-0 tw:-z-10 tw:w-2/3 tw:rounded-card tw:blur-ambient tw:opacity-ambient tw:transition-opacity tw:duration-slow tw:ease-standard tw:starting:opacity-0 tw:in-data-[ambient=off]:hidden tw:in-data-[contrast=more]:hidden',
    kicker: 'tw:m-0 tw:text-overline tw:text-accent-ink tw:uppercase',
    note: 'tw:m-0 tw:line-clamp-2 tw:max-w-reading-max tw:font-editorial tw:text-editorial tw:text-fg tw:large:line-clamp-3',
    window: 'tw:m-0 tw:min-h-[1lh] tw:text-caption tw:text-fg-muted',
    actions:
      'tw:relative tw:z-1 tw:flex tw:flex-wrap tw:items-center tw:gap-inline tw:max-medium:[&>[data-slot=button]]:flex-1',
  },
  variants: {
    layout: {
      responsive: {
        root: 'tw:expanded:[&_[data-slot=video-card]]:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] tw:expanded:[&_[data-slot=video-card]]:grid-rows-[repeat(8,auto)_minmax(0,1fr)] tw:expanded:[&_[data-slot=video-card]]:gap-x-section tw:expanded:[&_[data-slot=video-card]]:gap-y-0 tw:expanded:[&_[data-slot=video-card]>*]:col-start-2 tw:expanded:[&_[data-slot=video-card]>*]:mb-inline tw:expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:col-start-1 tw:expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:row-[1/-1] tw:expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:mb-0',
      },
      default: {
        root: 'tw:[&_[data-slot=video-card]]:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] tw:[&_[data-slot=video-card]]:grid-rows-[repeat(8,auto)_minmax(0,1fr)] tw:[&_[data-slot=video-card]]:gap-x-section tw:[&_[data-slot=video-card]]:gap-y-0 tw:[&_[data-slot=video-card]>*]:col-start-2 tw:[&_[data-slot=video-card]>*]:mb-inline tw:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:col-start-1 tw:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:row-[1/-1] tw:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:mb-0',
      },
      stacked: {},
    } satisfies Record<PickOfTheDayLayoutStyle, object>,
  },
  defaultVariants: { layout: 'responsive' },
});
