import { tv } from '@vp/ui';
import type { NotificationCentreLayout } from './types';

export const notificationCentreStyles = tv({
  slots: {
    trigger: 'tw:relative',
    badge:
      'tw:pointer-events-none tw:absolute tw:end-0 tw:top-0 tw:min-w-[1.25rem] tw:justify-center',
    panel: 'tw:flex tw:flex-col tw:overflow-hidden tw:p-0',
    header:
      'tw:flex tw:min-h-[3.5rem] tw:shrink-0 tw:items-center tw:gap-inline tw:ps-inset-card tw:pe-inset-control',
    title: 'tw:m-0 tw:me-auto tw:text-title',
    filters: 'tw:flex tw:shrink-0 tw:px-inset-card tw:pb-inline',
    body: 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:overscroll-contain tw:border-y-divider tw:border-border',
    notice:
      'tw:flex tw:shrink-0 tw:items-center tw:gap-inline tw:px-inset-card tw:py-inline tw:text-body-sm tw:text-fg-muted',
    group: 'tw:flex tw:flex-col',
    groupHeading:
      'tw:m-0 tw:px-inset-card tw:pt-stack tw:pb-inline tw:text-overline tw:text-fg-muted',
    list: 'tw:m-0 tw:flex tw:list-none tw:flex-col tw:p-0',
    row: 'tw:group/item tw:relative tw:flex',
    item: 'tw:grid tw:min-h-[4.5rem] tw:w-full tw:cursor-pointer tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:content-start tw:gap-x-stack tw:gap-y-inline tw:border-0 tw:bg-transparent tw:py-stack tw:ps-inset-card tw:pe-inset-control tw:text-start tw:font-sans tw:text-body-sm tw:text-fg tw:no-underline tw:transition-colors tw:duration-fast tw:hover:bg-tint tw:focus-ring tw:group-data-unread/item:bg-accent-soft',
    dot: 'tw:pointer-events-none tw:absolute tw:start-[0.5rem] tw:top-[1.75rem] tw:size-[0.5rem] tw:rounded-full tw:bg-accent tw:opacity-0 tw:transition-opacity tw:duration-fast tw:group-data-unread/item:opacity-100',
    avatar: 'tw:row-span-2',
    text: 'tw:line-clamp-3',
    time: 'tw:col-start-2 tw:row-start-2 tw:text-caption tw:text-fg-muted tw:group-data-unread/item:text-fg',
    thumbnail:
      'tw:col-start-3 tw:row-span-2 tw:row-start-1 tw:hidden tw:aspect-video tw:w-[6rem] tw:rounded-sm tw:object-cover tw:large:block',
  },
  variants: {
    layout: {
      popover: {
        panel:
          'tw:max-h-[min(30rem,calc(100dvh-var(--spacing-header)-2rem))] tw:w-[22.5rem] tw:shadow-3 tw:expanded:w-[25rem]',
      },
      sheet: { panel: 'tw:h-[85dvh] tw:max-h-none tw:gap-0 tw:px-0' },
    } satisfies Record<NotificationCentreLayout, object>,
  },
  defaultVariants: { layout: 'popover' },
});
