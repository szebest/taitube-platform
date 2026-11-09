import { tv } from '@vp/ui';
import type { VideoCardSize, VideoCardState, VideoCardVariant } from './types';

const BODY = 'col-start-1 min-w-0';

export const videoCardStyles = tv({
  slots: {
    root: 'group/card relative isolate grid grid-cols-[minmax(0,1fr)_auto] content-start items-start gap-x-inline gap-y-1 font-sans text-fg before:pointer-events-none before:absolute before:-inset-inline before:z-behind before:rounded-card before:bg-raised before:opacity-0 before:shadow-3 before:transition-opacity before:duration-slow before:ease-settle data-expanded:z-lift data-expanded:before:opacity-100',
    thumb:
      'col-span-full mb-inline transition-[translate,box-shadow] duration-slow ease-settle pointer-fine:group-hover/card:translate-y-[calc(-2px*var(--motion-travel))] pointer-fine:group-hover/card:shadow-2',
    preview: 'absolute inset-0 size-full animate-fade-in bg-media object-cover',
    byline: `${BODY} relative z-lift block w-fit max-w-full truncate text-overline text-fg-muted uppercase no-underline focus-ring hover:text-fg`,
    avatar: 'me-inline inline-flex align-middle',
    title: `${BODY} m-0 line-clamp-2 text-title text-balance text-fg no-underline focus-ring after:absolute after:inset-0 after:content-[''] aria-disabled:pointer-events-none aria-disabled:text-fg-muted`,
    meta: `${BODY} m-0 text-body-sm text-fg-muted`,
    snippet: `${BODY} m-0 line-clamp-2 text-body-sm text-fg-muted`,
    reason: `${BODY} m-0 flex items-center gap-inline text-caption text-accent-ink`,
    reasonDot: 'size-1.5 shrink-0 rounded-full bg-current',
    menu: 'relative z-lift col-start-2 row-start-2 row-span-2 opacity-0 transition-opacity duration-fast ease-standard group-hover/card:opacity-100 group-focus-within/card:opacity-100 pointer-coarse:opacity-100 has-[[data-state=open]]:opacity-100',
    panel:
      'absolute inset-x-0 inset-be-0 z-lift flex animate-pop-in flex-col gap-inline bg-raised pt-inline',
    description: 'm-0 line-clamp-2 text-body-sm text-fg-muted',
    actions: 'flex flex-wrap gap-inline',
  },
  variants: {
    variant: {
      grid: {},
      shelf: {},
      row: {
        root: 'grid-cols-[var(--layout-row-thumb)_minmax(0,1fr)_auto] gap-x-stack',
        thumb: 'col-span-1 col-start-1 row-span-5 row-start-1 mb-0',
        byline: 'col-start-2',
        title: 'col-start-2 text-body',
        meta: 'col-start-2',
        reason: 'col-start-2',
        menu: 'col-start-3 row-start-1',
      },
      poster: {
        root: 'grid-cols-1',
        thumb: 'mb-0',
        byline: 'hidden',
        title:
          'absolute inset-x-0 inset-be-0 z-base rounded-b-thumb bg-linear-to-t from-scrim px-inline pt-section pb-inline text-label text-on-live',
        meta: 'hidden',
        reason: 'hidden',
        menu: 'absolute inset-bs-inline inset-e-inline',
      },
      spotlight: {
        root: 'gap-y-inline',
        thumb: 'max-w-[640px]',
        title: 'text-headline large:text-display',
        meta: 'text-body',
      },
    } satisfies Record<VideoCardVariant, object>,
    state: {
      rest: {},
      live: {},
      premiere: {},
      unavailable: { title: 'text-fg-muted' },
    } satisfies Record<VideoCardState, object>,
    size: {
      sm: {},
      md: {},
    } satisfies Record<VideoCardSize, object>,
  },
  compoundVariants: [
    {
      variant: 'row',
      size: 'sm',
      class: { root: 'grid-cols-[120px_minmax(0,1fr)_auto]' },
    },
  ],
  defaultVariants: { variant: 'grid', state: 'rest', size: 'md' },
});
