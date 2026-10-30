import { tv } from '@vp/ui';
import type { QueueLayout } from './types';

export const queueStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-col tw:gap-stack tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:p-[0.875rem] tw:text-fg',
    header: 'tw:flex tw:items-center tw:justify-between tw:gap-inline',
    heading: 'tw:m-0 tw:min-w-0 tw:truncate tw:text-title',
    position: 'tw:font-mono tw:text-mono tw:text-fg-muted',
    modes: 'tw:m-0 tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:border-0 tw:p-0',
    list: 'tw:min-h-0',
    item: 'tw:rounded-card tw:p-1 tw:transition-colors tw:duration-fast tw:ease-standard tw:aria-[current=true]:bg-accent-soft',
    itemBody: 'tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1',
    nowPlaying: 'tw:m-0 tw:text-overline tw:text-accent-ink tw:uppercase',
    recommendations:
      'tw:flex tw:flex-col tw:gap-inline tw:border-t-divider tw:border-border tw:pt-stack',
    recommendationsHeading: 'tw:m-0 tw:text-label tw:text-fg-muted',
    recommendationsList: 'tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1 tw:p-0',
  },
  variants: {
    layout: {
      side: {
        root: 'tw:sticky tw:top-header tw:max-h-[calc(100dvh-var(--layout-header))] tw:w-[25rem] tw:large:w-[26.25rem]',
        list: 'tw:overflow-y-auto',
      },
      below: { root: 'tw:w-full' },
      sheet: { root: 'tw:h-full tw:border-0 tw:bg-transparent tw:p-0', list: 'tw:overflow-y-auto' },
      auto: {
        root: 'tw:w-full tw:expanded:sticky tw:expanded:top-header tw:expanded:max-h-[calc(100dvh-var(--layout-header))] tw:expanded:w-[25rem] tw:large:w-[26.25rem]',
        list: 'tw:expanded:overflow-y-auto',
      },
    } satisfies Record<QueueLayout | 'auto', object>,
  },
  defaultVariants: { layout: 'auto' },
});
