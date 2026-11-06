import { tv } from '@vp/ui';
import type { NotificationCentreLayout } from './types';

export const notificationCentreStyles = tv({
  slots: {
    trigger: 'relative',
    badge: 'pointer-events-none absolute end-0 top-0 min-w-[1.25rem] justify-center',
    panel: 'flex flex-col overflow-hidden p-0',
    header: 'flex min-h-[3.5rem] shrink-0 items-center gap-inline ps-inset-card pe-inset-control',
    title: 'm-0 me-auto text-title',
    filters: 'flex shrink-0 px-inset-card pb-inline',
    body: 'min-h-0 flex-1 overflow-y-auto overscroll-contain border-y-divider border-border',
    notice:
      'flex shrink-0 items-center gap-inline px-inset-card py-inline text-body-sm text-fg-muted',
    group: 'flex flex-col',
    groupHeading: 'm-0 px-inset-card pt-stack pb-inline text-overline text-fg-muted',
    list: 'm-0 flex list-none flex-col p-0',
    row: 'group/item relative flex',
    item: 'grid min-h-[4.5rem] w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] content-start gap-x-stack gap-y-inline border-0 bg-transparent py-stack ps-inset-card pe-inset-control text-start font-sans text-body-sm text-fg no-underline transition-colors duration-fast hover:bg-tint focus-ring group-data-unread/item:bg-accent-soft',
    dot: 'pointer-events-none absolute start-[0.5rem] top-[1.75rem] size-[0.5rem] rounded-full bg-accent opacity-0 transition-opacity duration-fast group-data-unread/item:opacity-100',
    avatar: 'row-span-2',
    text: 'line-clamp-3',
    time: 'col-start-2 row-start-2 text-caption text-fg-muted group-data-unread/item:text-fg',
    thumbnail:
      'col-start-3 row-span-2 row-start-1 hidden aspect-video w-[6rem] rounded-sm object-cover large:block',
  },
  variants: {
    layout: {
      popover: {
        panel:
          'max-h-[min(30rem,calc(100dvh-var(--layout-header)-2rem))] w-[22.5rem] shadow-3 expanded:w-[25rem]',
      },
      sheet: { panel: 'h-[85dvh] max-h-none gap-0 px-0' },
    } satisfies Record<NotificationCentreLayout, object>,
  },
  defaultVariants: { layout: 'popover' },
});
