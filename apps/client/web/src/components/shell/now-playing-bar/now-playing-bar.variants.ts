import { tv } from '@vp/ui';
import type { NowPlayingBarStatus } from './types';

export const nowPlayingBarStyles = tv({
  slots: {
    root: 'tw:relative tw:flex tw:min-h-[4.5rem] tw:items-center tw:gap-inline tw:overflow-hidden tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:p-inline tw:font-sans tw:text-fg tw:shadow-3 tw:transition-[opacity,translate] tw:duration-base tw:ease-enter tw:starting:opacity-0 tw:motion-safe:starting:translate-y-stack tw:medium:px-inset-control',
    media:
      'tw:relative tw:aspect-video tw:w-[5.5rem] tw:shrink-0 tw:overflow-hidden tw:rounded-sm tw:bg-media tw:medium:w-32',
    mediaSlot: 'tw:size-full tw:*:block tw:*:size-full tw:*:object-cover',
    buffering: 'tw:absolute tw:inset-0 tw:m-auto tw:text-on-live',
    info: 'tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:text-start',
    title: 'tw:m-0 tw:truncate tw:text-label',
    subtitle: 'tw:m-0 tw:truncate tw:text-body-sm tw:text-fg-muted',
    transport: 'tw:flex tw:shrink-0 tw:items-center',
    previous: 'tw:hidden tw:medium:inline-flex',
    time: 'tw:hidden tw:shrink-0 tw:text-mono tw:text-fg-muted tw:tabular-nums tw:expanded:inline',
    queue: 'tw:shrink-0',
    queueCount: 'tw:text-caption tw:tabular-nums',
    expand: 'tw:order-last tw:shrink-0',
    seek: 'tw:absolute tw:inset-x-0 tw:top-0 tw:h-[0.75rem] tw:cursor-pointer tw:touch-none tw:outline-none tw:focus-visible:bg-tint',
    track: 'tw:absolute tw:inset-x-0 tw:top-0 tw:h-[0.125rem] tw:bg-tint-strong',
    fill: 'tw:h-full tw:bg-accent',
  },
  variants: {
    status: {
      ready: {},
      buffering: {},
      live: {},
      unavailable: { title: 'tw:text-fg-muted', media: 'tw:opacity-60' },
    } satisfies Record<NowPlayingBarStatus, object>,
  },
  defaultVariants: { status: 'ready' },
});
