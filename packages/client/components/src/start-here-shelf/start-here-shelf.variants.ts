import { tv } from '@vp/ui';
import type { StartHereSource } from './types';

export const startHereShelfStyles = tv({
  slots: {
    header: 'tw:flex-col tw:items-start',
    kicker: '',
    note: 'tw:line-clamp-2 tw:max-w-reading-max tw:whitespace-normal tw:text-fg',
    track: 'tw:has-[>li:only-child]:auto-cols-[minmax(0,40rem)]',
    item: 'tw:relative',
    position:
      'tw:pointer-events-none tw:absolute tw:inset-bs-inline tw:inset-s-inline tw:z-1 tw:flex tw:min-w-[1.25rem] tw:items-center tw:justify-center tw:rounded-xs tw:bg-scrim tw:px-1 tw:font-mono tw:text-mono tw:text-on-live tw:tabular-nums',
    footer: 'tw:flex tw:flex-wrap tw:items-baseline tw:gap-x-stack tw:gap-y-1',
    attribution: 'tw:m-0 tw:text-caption tw:text-fg-muted',
  },
  variants: {
    source: {
      pinned: { kicker: 'tw:text-overline tw:text-accent-ink tw:uppercase' },
      popular: {},
    } satisfies Record<StartHereSource, object>,
  },
  defaultVariants: { source: 'pinned' },
});
