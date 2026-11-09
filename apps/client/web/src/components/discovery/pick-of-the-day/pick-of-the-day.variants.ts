import { tv } from '@vp/ui';
import type { PickOfTheDayLayoutStyle } from './types';

export const pickOfTheDayStyles = tv({
  slots: {
    root: 'relative isolate animate-fade-in rounded-card p-inset-card before:absolute before:inset-0 before:z-behind before:rounded-card before:bg-surface font-sans text-fg [animation-duration:var(--duration-base)] medium:[&_[data-slot=video-card-thumb]]:max-w-[30rem] expanded:[&_[data-slot=video-card-thumb]]:max-w-[40rem]',
    glow: 'pointer-events-none absolute inset-y-0 start-0 z-behind w-2/3 rounded-card blur-ambient opacity-ambient transition-opacity duration-slow ease-standard starting:opacity-0 in-data-[ambient=off]:hidden in-data-[contrast=more]:hidden',
    kicker: 'm-0 text-overline text-accent-ink uppercase',
    note: 'm-0 line-clamp-2 max-w-reading-max font-editorial text-editorial text-fg large:line-clamp-3',
    window: 'm-0 min-h-[1lh] text-caption text-fg-muted',
    actions:
      'relative z-lift flex flex-wrap items-center gap-inline max-medium:[&>[data-slot=button]]:flex-1',
  },
  variants: {
    layout: {
      responsive: {
        root: 'expanded:[&_[data-slot=video-card]]:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] expanded:[&_[data-slot=video-card]]:grid-rows-[repeat(8,auto)_minmax(0,1fr)] expanded:[&_[data-slot=video-card]]:gap-x-section expanded:[&_[data-slot=video-card]]:gap-y-0 expanded:[&_[data-slot=video-card]>*]:col-start-2 expanded:[&_[data-slot=video-card]>*]:mb-inline expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:col-start-1 expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:row-[1/-1] expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:mb-0',
      },
      default: {
        root: '[&_[data-slot=video-card]]:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] [&_[data-slot=video-card]]:grid-rows-[repeat(8,auto)_minmax(0,1fr)] [&_[data-slot=video-card]]:gap-x-section [&_[data-slot=video-card]]:gap-y-0 [&_[data-slot=video-card]>*]:col-start-2 [&_[data-slot=video-card]>*]:mb-inline [&_[data-slot=video-card]>[data-slot=video-card-thumb]]:col-start-1 [&_[data-slot=video-card]>[data-slot=video-card-thumb]]:row-[1/-1] [&_[data-slot=video-card]>[data-slot=video-card-thumb]]:mb-0',
      },
      stacked: {},
    } satisfies Record<PickOfTheDayLayoutStyle, object>,
  },
  defaultVariants: { layout: 'responsive' },
});
