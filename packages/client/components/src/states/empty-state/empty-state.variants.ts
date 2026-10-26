import { tv } from '@vp/ui';
import type { EmptyStateSize, EmptyStateTitleStyle } from './types';

export const emptyStateStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-wrap tw:items-center tw:gap-x-stack tw:gap-y-inline tw:font-sans tw:text-fg',
    illustration: 'tw:flex tw:basis-full tw:justify-center tw:text-accent tw:*:block tw:*:h-auto',
    title: 'tw:m-0 tw:basis-full',
    description: 'tw:m-0 tw:box-border tw:basis-full tw:text-body tw:text-fg-muted',
    secondary: 'tw:text-body tw:text-accent-ink tw:underline',
  },
  variants: {
    size: {
      page: {
        root: 'tw:justify-center tw:py-section tw:text-center',
        illustration: 'tw:*:w-[11.25rem]',
        description: 'tw:px-[max(0px,calc(50%-16.25rem))]',
      },
      section: {
        root: 'tw:justify-center tw:p-inset-card tw:text-center',
        illustration: 'tw:*:w-[7.5rem]',
        description: 'tw:px-[max(0px,calc(50%-16.25rem))]',
      },
      inline: { root: 'tw:justify-start tw:text-start', illustration: 'tw:hidden' },
    } satisfies Record<EmptyStateSize, object>,
    titleStyle: {
      'title-lg': { title: 'tw:text-title-lg' },
      editorial: { title: 'tw:font-editorial tw:text-editorial' },
    } satisfies Record<EmptyStateTitleStyle, object>,
  },
  compoundVariants: [{ size: 'inline', class: { title: 'tw:text-body' } }],
  defaultVariants: { size: 'page', titleStyle: 'title-lg' },
});
