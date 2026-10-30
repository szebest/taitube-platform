import { tv } from '@vp/ui';
import type { ChannelHeaderLayout } from './types';

export const channelHeaderStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-col tw:gap-stack tw:font-sans tw:text-fg',
    bannerFrame: 'tw:relative tw:isolate tw:max-medium:-mx-gutter-compact',
    glow: 'tw:pointer-events-none tw:absolute tw:-inset-stack tw:-z-10 tw:blur-ambient tw:opacity-ambient tw:transition-opacity tw:duration-slow tw:ease-standard tw:starting:opacity-0 tw:in-data-[ambient=off]:hidden tw:in-data-[contrast=more]:hidden',
    banner:
      'tw:relative tw:aspect-[3/1] tw:overflow-hidden tw:bg-surface tw:medium:aspect-[4/1] tw:medium:rounded-card tw:expanded:aspect-[6/1]',
    bannerMedia: 'tw:size-full tw:object-cover',
    bannerTint:
      'tw:absolute tw:inset-0 tw:opacity-ambient tw:transition-opacity tw:duration-slow tw:ease-standard tw:starting:opacity-0 tw:in-data-[ambient=off]:hidden',
    bannerFade: 'tw:absolute tw:inset-0 tw:bg-linear-to-t tw:from-surface tw:to-transparent',
    identity:
      'tw:grid tw:grid-cols-[auto_minmax(0,1fr)] tw:items-center tw:gap-x-stack tw:gap-y-inline tw:text-inherit tw:no-underline tw:medium:grid-cols-[auto_minmax(0,1fr)_auto]',
    avatar:
      'tw:row-span-2 tw:max-medium:size-[4.5rem] tw:medium:row-span-3 tw:[&_[data-slot=avatar-fallback]]:text-headline',
    nameRow: 'tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-inline',
    name: 'tw:m-0 tw:min-w-0 tw:text-title-lg tw:text-balance tw:break-words tw:medium:text-headline',
    verified: 'tw:shrink-0 tw:text-fg-muted',
    stats: 'tw:m-0 tw:min-w-0 tw:text-body-sm tw:text-fg-muted tw:break-words',
    bio: 'tw:col-span-full tw:flex tw:min-w-0 tw:flex-col tw:items-start tw:gap-inline tw:text-body-sm tw:text-fg-muted tw:medium:col-span-1 tw:medium:col-start-2',
    bioText: 'tw:m-0 tw:line-clamp-2 tw:max-w-reading-max',
    actions:
      'tw:col-span-full tw:flex tw:items-center tw:gap-inline tw:medium:col-span-1 tw:medium:col-start-3 tw:medium:row-span-3 tw:medium:row-start-1 tw:medium:justify-end',
    subscribe: 'tw:max-medium:flex-1',
    tabs: 'tw:border-b-divider tw:border-border',
    tabList:
      'tw:m-0 tw:flex tw:list-none tw:gap-inline tw:overflow-x-auto tw:p-0 tw:scroll-fade tw:[scrollbar-width:none]',
    tab: 'tw:inline-flex tw:h-control-md tw:shrink-0 tw:items-center tw:px-inset-control tw:text-label tw:whitespace-nowrap tw:text-fg-muted tw:no-underline tw:transition-[color,box-shadow] tw:duration-base tw:ease-settle tw:focus-ring tw:hover:text-fg tw:aria-[current=page]:text-accent-ink tw:aria-[current=page]:shadow-[inset_0_-2px_0_0_var(--accent)] tw:motion-reduce:transition-none',
  },
  variants: {
    layout: {
      full: { name: 'tw:large:text-display' },
      identity: {},
    } satisfies Record<ChannelHeaderLayout, object>,
  },
  defaultVariants: { layout: 'full' },
});
