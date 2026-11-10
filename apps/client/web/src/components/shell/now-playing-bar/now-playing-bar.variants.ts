import { tv } from '@vp/ui';
import type { NowPlayingBarStatus } from './types';

export const nowPlayingBarStyles = tv({
  slots: {
    root: 'relative flex min-h-[4.5rem] items-center gap-inline overflow-hidden rounded-card border-divider border-border bg-raised p-inline font-sans text-fg shadow-3 transition-[opacity,translate] duration-base ease-enter starting:opacity-0 motion-safe:starting:translate-y-stack medium:px-inset-control',
    media:
      'relative aspect-video w-[5.5rem] shrink-0 overflow-hidden rounded-sm bg-media medium:w-32',
    mediaSlot: 'size-full *:block *:size-full *:object-cover',
    buffering: 'absolute inset-0 m-auto text-on-live',
    info: 'flex min-w-0 flex-1 flex-col text-start',
    title: 'm-0 truncate text-label',
    subtitle: 'm-0 truncate text-body-sm text-fg-muted',
    transport: 'flex shrink-0 items-center',
    previous: 'hidden medium:inline-flex',
    time: 'hidden shrink-0 text-mono text-fg-muted tabular-nums expanded:inline',
    queue: 'shrink-0',
    queueCount: 'text-caption tabular-nums',
    expand: 'order-last shrink-0',
    seek: 'absolute inset-x-0 top-0 h-[0.75rem] cursor-pointer touch-none outline-none focus-visible:bg-tint',
    track: 'absolute inset-x-0 top-0 h-[0.125rem] bg-tint-strong',
    fill: 'h-full bg-accent',
  },
  variants: {
    status: {
      ready: {},
      buffering: {},
      live: {},
      unavailable: { title: 'text-fg-muted', media: 'opacity-60' },
    } satisfies Record<NowPlayingBarStatus, object>,
  },
  defaultVariants: { status: 'ready' },
});
