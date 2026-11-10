import { tv } from '@vp/ui';
import type { ChannelHeaderLayout } from './types';

export const channelHeaderStyles = tv({
  slots: {
    root: 'flex flex-col gap-stack font-sans text-fg',
    bannerFrame: 'relative isolate max-medium:-mx-gutter-compact',
    glow: 'pointer-events-none absolute -inset-stack z-behind blur-ambient opacity-ambient transition-opacity duration-slow ease-standard starting:opacity-0 in-data-[ambient=off]:hidden in-data-[contrast=more]:hidden',
    banner:
      'relative aspect-[3/1] overflow-hidden bg-surface medium:aspect-[4/1] medium:rounded-card expanded:aspect-[6/1]',
    bannerMedia: 'block size-full object-cover [&_img]:size-full [&_img]:object-cover',
    bannerSafeArea:
      'pointer-events-none absolute inset-y-0 inset-x-[19.8%] flex items-end justify-end p-inline',
    bannerLink: 'pointer-events-auto',
    bannerTint:
      'absolute inset-0 opacity-ambient transition-opacity duration-slow ease-standard starting:opacity-0 in-data-[ambient=off]:hidden',
    bannerFade: 'absolute inset-0 bg-linear-to-t from-surface to-transparent',
    identity:
      'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-stack gap-y-inline text-inherit no-underline medium:grid-cols-[auto_minmax(0,1fr)_auto]',
    avatar:
      'row-span-2 max-medium:size-[4.5rem] medium:row-span-3 [&_[data-slot=avatar-fallback]]:text-headline',
    nameRow: 'flex min-w-0 flex-wrap items-center gap-inline',
    name: 'm-0 min-w-0 text-title-lg text-balance break-words medium:text-headline',
    verified: 'shrink-0 text-fg-muted',
    stats: 'm-0 min-w-0 text-body-sm text-fg-muted break-words',
    bio: 'col-span-full flex min-w-0 flex-col items-start gap-inline text-body-sm text-fg-muted medium:col-span-1 medium:col-start-2',
    bioText: 'm-0 line-clamp-2 max-w-reading-max',
    actions:
      'col-span-full flex items-center gap-inline medium:col-span-1 medium:col-start-3 medium:row-span-3 medium:row-start-1 medium:justify-end',
    tabs: 'border-b-divider border-border',
    tabList: 'm-0 flex list-none gap-inline overflow-x-auto p-0 scroll-fade [scrollbar-width:none]',
    tab: 'inline-flex h-control-md shrink-0 items-center px-inset-control text-label whitespace-nowrap text-fg-muted no-underline transition-[color,box-shadow] duration-base ease-settle focus-ring hover:text-fg aria-[current=page]:text-accent-ink aria-[current=page]:shadow-[inset_0_-2px_0_0_var(--accent)] motion-reduce:transition-none',
  },
  variants: {
    layout: {
      full: { name: 'large:text-display' },
      identity: {},
    } satisfies Record<ChannelHeaderLayout, object>,
  },
  defaultVariants: { layout: 'full' },
});
