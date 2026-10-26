import { tv } from '@vp/ui';
import type { PageHeaderTitleStyle } from './types';

export const pageHeaderStyles = tv({
  slots: {
    root: 'tw:grid tw:grid-flow-dense tw:grid-cols-1 tw:gap-x-stack tw:gap-y-inline tw:py-stack tw:font-sans tw:text-fg tw:medium:grid-cols-[minmax(0,1fr)_auto]',
    back: 'tw:col-span-full tw:text-body-sm tw:text-fg-muted',
    title: 'tw:m-0 tw:text-title-lg tw:text-balance tw:expanded:text-headline',
    description: 'tw:m-0 tw:max-w-reading-max tw:text-body tw:text-fg-muted tw:medium:col-start-1',
    actions:
      'tw:flex tw:flex-wrap tw:items-center tw:gap-inline tw:medium:col-start-2 tw:medium:row-start-auto tw:medium:justify-end',
    tabs: 'tw:col-span-full tw:border-b tw:border-border tw:border-divider',
  },
  variants: {
    titleStyle: {
      headline: {},
      display: {
        title: 'tw:large:text-display',
        description: 'tw:font-editorial tw:text-editorial',
      },
    } satisfies Record<PageHeaderTitleStyle, object>,
  },
  defaultVariants: { titleStyle: 'headline' },
});
