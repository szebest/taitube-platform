import { tv } from '@vp/ui';
import type { StartHereSource } from './types';

export const startHereShelfStyles = tv({
  slots: {
    header: 'flex-col items-start',
    kicker: '',
    note: 'line-clamp-2 max-w-reading-max whitespace-normal text-fg',
    track: 'has-[>li:only-child]:auto-cols-[minmax(0,40rem)]',
    item: 'relative',
    position:
      'pointer-events-none absolute inset-bs-inline inset-s-inline z-1 flex min-w-[1.25rem] items-center justify-center rounded-xs bg-scrim px-1 font-mono text-mono text-on-live tabular-nums',
    footer: 'flex flex-wrap items-baseline gap-x-stack gap-y-1',
    attribution: 'm-0 text-caption text-fg-muted',
  },
  variants: {
    source: {
      pinned: { kicker: 'text-overline text-accent-ink uppercase' },
      popular: {},
    } satisfies Record<StartHereSource, object>,
  },
  defaultVariants: { source: 'pinned' },
});
