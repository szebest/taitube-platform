import { tv } from '@vp/ui';
import type { QueueLayout } from './types';

export const queueStyles = tv({
  slots: {
    root: 'flex flex-col gap-stack rounded-card border-divider border-border bg-surface p-[0.875rem] text-fg',
    header: 'flex items-center justify-between gap-inline',
    heading: 'm-0 min-w-0 truncate text-title',
    position: 'font-mono text-mono text-fg-muted',
    modes: 'm-0 flex min-w-0 items-center gap-1 border-0 p-0',
    list: 'min-h-0',
    item: 'rounded-card p-1 transition-colors duration-fast ease-standard aria-[current=true]:bg-accent-soft',
    itemBody: 'flex min-w-0 flex-1 flex-col gap-1',
    nowPlaying: 'm-0 text-overline text-accent-ink uppercase',
    recommendations: 'flex flex-col gap-inline border-t-divider border-border pt-stack',
    recommendationsHeading: 'm-0 text-label text-fg-muted',
    recommendationsList: 'm-0 flex list-none flex-col gap-1 p-0',
  },
  variants: {
    layout: {
      side: {
        root: 'sticky top-header max-h-[calc(100dvh-var(--layout-header))] w-[25rem] large:w-[26.25rem]',
        list: 'overflow-y-auto',
      },
      below: { root: 'w-full' },
      sheet: { root: 'h-full border-0 bg-transparent p-0', list: 'overflow-y-auto' },
      auto: {
        root: 'w-full expanded:sticky expanded:top-header expanded:max-h-[calc(100dvh-var(--layout-header))] expanded:w-[25rem] large:w-[26.25rem]',
        list: 'expanded:overflow-y-auto',
      },
    } satisfies Record<QueueLayout | 'auto', object>,
  },
  defaultVariants: { layout: 'auto' },
});
