import { tv } from '@vp/ui';
import type { EngagementBarLayout } from './types';

const BAR_ACTIONS = 'basis-auto ms-auto flex-wrap justify-end overflow-visible [mask-image:none]';

export const engagementBarStyles = tv({
  slots: {
    root: 'group/engagement flex flex-wrap items-center gap-x-stack gap-y-inline text-fg',
    channel: 'flex min-w-0 items-center gap-inline rounded-control text-fg no-underline focus-ring',
    channelText: 'flex min-w-0 flex-col',
    channelName: 'truncate text-title',
    channelMeta: 'truncate text-body-sm text-fg-muted',
    actions: 'flex min-w-0 basis-full items-center gap-inline overflow-x-auto scroll-fade',
    reaction: 'm-0 inline-flex min-w-0 shrink-0 overflow-hidden rounded-chip border-0 bg-tint p-0',
    reactionHalf: 'rounded-none bg-transparent',
    actionLabel: 'max-medium:sr-only',
    count: 'font-mono tabular-nums',
  },
  variants: {
    layout: {
      bar: { actions: BAR_ACTIONS },
      stacked: {},
      auto: {
        actions:
          'expanded:basis-auto expanded:ms-auto expanded:flex-wrap expanded:justify-end expanded:overflow-visible expanded:[mask-image:none]',
      },
    } satisfies Record<EngagementBarLayout | 'auto', object>,
  },
  defaultVariants: { layout: 'auto' },
});
