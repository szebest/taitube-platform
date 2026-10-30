import { tv } from '@vp/ui';
import type { OfflineStateSize, OfflineStateTone } from './types';

export const offlineStateStyles = tv({
  slots: {
    root: 'tw:flex tw:font-sans tw:text-fg',
    icon: 'tw:shrink-0 tw:transition-opacity tw:duration-base tw:starting:opacity-0',
    title: 'tw:m-0',
    description: 'tw:m-0 tw:text-body tw:text-fg-muted',
    available: 'tw:flex tw:flex-col tw:gap-inline',
    availableHeading: 'tw:m-0 tw:text-overline tw:text-fg-muted',
    list: 'tw:m-0 tw:list-none tw:gap-inline tw:p-0',
    link: 'tw:flex tw:min-h-touch-target tw:items-center tw:gap-stack tw:text-body tw:text-fg tw:no-underline tw:focus-ring',
    count: 'tw:text-body-sm tw:text-fg-muted',
    action: 'tw:order-last',
  },
  variants: {
    size: {
      page: {
        root: 'tw:flex-wrap tw:items-center tw:justify-center tw:gap-x-stack tw:gap-y-inline tw:py-section tw:text-center',
        icon: 'tw:basis-full tw:size-icon-lg',
        title: 'tw:basis-full tw:text-title-lg',
        description: 'tw:basis-full tw:px-[max(0px,calc(50%-16.25rem))]',
        available: 'tw:basis-full tw:items-center tw:py-stack',
        list: 'tw:grid tw:w-full tw:max-w-[60rem] tw:medium:grid-cols-2 tw:large:grid-cols-3',
        link: 'tw:justify-between tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:p-inset-card tw:text-start tw:transition-colors tw:duration-fast tw:hover:bg-tint',
      },
      banner: {
        root: 'tw:items-center tw:gap-inline tw:border-b-divider tw:border-border tw:bg-raised tw:px-gutter-compact tw:py-inline tw:transition-[opacity,translate] tw:duration-base tw:ease-enter tw:starting:opacity-0 tw:motion-safe:starting:-translate-y-inline tw:medium:px-gutter-medium',
        icon: 'tw:size-icon-md',
        title: 'tw:min-w-0 tw:flex-1 tw:truncate tw:text-label',
        description: 'tw:hidden',
        available: 'tw:hidden',
        action: 'tw:hidden',
      },
      section: {
        root: 'tw:flex-wrap tw:items-center tw:gap-x-stack tw:gap-y-inline tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:p-inset-card',
        icon: 'tw:size-icon-lg',
        title: 'tw:min-w-0 tw:flex-1 tw:text-title',
        description: 'tw:basis-full',
        available: 'tw:basis-full',
        list: 'tw:flex tw:flex-wrap tw:gap-x-stack',
        link: 'tw:text-accent-ink tw:underline',
      },
    } satisfies Record<OfflineStateSize, object>,
    tone: {
      neutral: { icon: 'tw:text-fg-muted' },
      success: { icon: 'tw:text-success-ink' },
    } satisfies Record<OfflineStateTone, object>,
  },
  defaultVariants: { size: 'page', tone: 'neutral' },
});
