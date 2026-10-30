import { tv } from '@vp/ui';
import type { EngagementBarLayout } from './types';

const BAR_ACTIONS = 'tw:basis-auto tw:ms-auto tw:overflow-visible tw:[mask-image:none]';

export const engagementBarStyles = tv({
  slots: {
    root: 'tw:group/engagement tw:flex tw:flex-wrap tw:items-center tw:gap-x-stack tw:gap-y-inline tw:text-fg',
    channel:
      'tw:flex tw:min-w-0 tw:items-center tw:gap-inline tw:rounded-control tw:text-fg tw:no-underline tw:focus-ring',
    channelText: 'tw:flex tw:min-w-0 tw:flex-col',
    channelName: 'tw:truncate tw:text-title',
    channelMeta: 'tw:truncate tw:text-body-sm tw:text-fg-muted',
    actions:
      'tw:flex tw:min-w-0 tw:basis-full tw:items-center tw:gap-inline tw:overflow-x-auto tw:scroll-fade',
    reaction:
      'tw:m-0 tw:inline-flex tw:min-w-0 tw:shrink-0 tw:overflow-hidden tw:rounded-chip tw:border-0 tw:bg-tint tw:p-0',
    reactionHalf: 'tw:rounded-none tw:bg-transparent',
    actionLabel: 'tw:max-medium:sr-only',
    count: 'tw:font-mono tw:tabular-nums',
  },
  variants: {
    layout: {
      bar: { actions: BAR_ACTIONS },
      stacked: {},
      auto: {
        actions:
          'tw:expanded:basis-auto tw:expanded:ms-auto tw:expanded:overflow-visible tw:expanded:[mask-image:none]',
      },
    } satisfies Record<EngagementBarLayout | 'auto', object>,
  },
  defaultVariants: { layout: 'auto' },
});
