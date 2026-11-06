import { tv } from '@vp/ui';
import type { OfflineStateSize, OfflineStateTone } from './types';

export const offlineStateStyles = tv({
  slots: {
    root: 'flex font-sans text-fg',
    icon: 'shrink-0 transition-opacity duration-base starting:opacity-0',
    title: 'm-0',
    description: 'm-0 text-body text-fg-muted',
    available: 'flex flex-col gap-inline',
    availableHeading: 'm-0 text-overline text-fg-muted',
    list: 'm-0 list-none gap-inline p-0',
    link: 'flex min-h-touch-target items-center gap-stack text-body text-fg no-underline focus-ring',
    count: 'text-body-sm text-fg-muted',
    action: 'order-last',
  },
  variants: {
    size: {
      page: {
        root: 'flex-wrap items-center justify-center gap-x-stack gap-y-inline py-section text-center',
        icon: 'basis-full size-icon-lg',
        title: 'basis-full text-title-lg',
        description: 'basis-full px-[max(0px,calc(50%-16.25rem))]',
        available: 'basis-full items-center py-stack',
        list: 'grid w-full max-w-[60rem] medium:grid-cols-2 large:grid-cols-3',
        link: 'justify-between rounded-card border-divider border-border bg-surface p-inset-card text-start transition-colors duration-fast hover:bg-tint',
      },
      banner: {
        root: 'items-center gap-inline border-b-divider border-border bg-raised px-gutter-compact py-inline transition-[opacity,translate] duration-base ease-enter starting:opacity-0 motion-safe:starting:-translate-y-inline medium:px-gutter-medium',
        icon: 'size-icon-md',
        title: 'min-w-0 flex-1 truncate text-label',
        description: 'hidden',
        available: 'hidden',
        action: 'hidden',
      },
      section: {
        root: 'flex-wrap items-center gap-x-stack gap-y-inline rounded-card border-divider border-border bg-surface p-inset-card',
        icon: 'size-icon-lg',
        title: 'min-w-0 flex-1 text-title',
        description: 'basis-full',
        available: 'basis-full',
        list: 'flex flex-wrap gap-x-stack',
        link: 'text-accent-ink underline',
      },
    } satisfies Record<OfflineStateSize, object>,
    tone: {
      neutral: { icon: 'text-fg-muted' },
      success: { icon: 'text-success-ink' },
    } satisfies Record<OfflineStateTone, object>,
  },
  defaultVariants: { size: 'page', tone: 'neutral' },
});
