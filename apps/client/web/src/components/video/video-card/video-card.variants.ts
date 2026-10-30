import { tv } from '@vp/ui';
import type { VideoCardSize, VideoCardState, VideoCardVariant } from './types';

const BODY = 'tw:col-start-1 tw:min-w-0';

export const videoCardStyles = tv({
  slots: {
    root: 'tw:group/card tw:relative tw:isolate tw:grid tw:grid-cols-[minmax(0,1fr)_auto] tw:content-start tw:items-start tw:gap-x-inline tw:gap-y-1 tw:font-sans tw:text-fg tw:before:pointer-events-none tw:before:absolute tw:before:-inset-inline tw:before:-z-1 tw:before:rounded-card tw:before:bg-raised tw:before:opacity-0 tw:before:shadow-3 tw:before:transition-opacity tw:before:duration-slow tw:before:ease-settle tw:data-expanded:z-1 tw:data-expanded:before:opacity-100',
    thumb:
      'tw:col-span-full tw:mb-inline tw:transition-[translate,box-shadow] tw:duration-slow tw:ease-settle tw:pointer-fine:group-hover/card:translate-y-[calc(-2px*var(--motion-travel))] tw:pointer-fine:group-hover/card:shadow-2',
    preview: 'tw:absolute tw:inset-0 tw:size-full tw:animate-fade-in tw:bg-media tw:object-cover',
    byline: `${BODY} tw:relative tw:z-1 tw:block tw:w-fit tw:max-w-full tw:truncate tw:text-overline tw:text-fg-muted tw:uppercase tw:no-underline tw:focus-ring tw:hover:text-fg`,
    avatar: 'tw:me-inline tw:inline-flex tw:align-middle',
    title: `${BODY} tw:m-0 tw:line-clamp-2 tw:text-title tw:text-balance tw:text-fg tw:no-underline tw:focus-ring tw:after:absolute tw:after:inset-0 tw:after:content-[''] tw:aria-disabled:pointer-events-none tw:aria-disabled:text-fg-muted`,
    meta: `${BODY} tw:m-0 tw:text-body-sm tw:text-fg-muted`,
    reason: `${BODY} tw:m-0 tw:flex tw:items-center tw:gap-inline tw:text-caption tw:text-accent-ink`,
    reasonDot: 'tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-current',
    menu: 'tw:relative tw:z-1 tw:col-start-2 tw:row-start-2 tw:row-span-2 tw:opacity-0 tw:transition-opacity tw:duration-fast tw:ease-standard tw:group-hover/card:opacity-100 tw:group-focus-within/card:opacity-100 tw:pointer-coarse:opacity-100 tw:has-[[data-state=open]]:opacity-100',
    panel:
      'tw:absolute tw:inset-x-0 tw:inset-be-0 tw:z-1 tw:flex tw:animate-pop-in tw:flex-col tw:gap-inline tw:bg-raised tw:pt-inline',
    description: 'tw:m-0 tw:line-clamp-2 tw:text-body-sm tw:text-fg-muted',
    actions: 'tw:flex tw:flex-wrap tw:gap-inline',
  },
  variants: {
    variant: {
      grid: {},
      shelf: {},
      row: {
        root: 'tw:grid-cols-[var(--layout-row-thumb)_minmax(0,1fr)_auto] tw:gap-x-stack',
        thumb: 'tw:col-span-1 tw:col-start-1 tw:row-span-5 tw:row-start-1 tw:mb-0',
        byline: 'tw:col-start-2',
        title: 'tw:col-start-2 tw:text-body',
        meta: 'tw:col-start-2',
        reason: 'tw:col-start-2',
        menu: 'tw:col-start-3 tw:row-start-1',
      },
      poster: {
        root: 'tw:grid-cols-1',
        thumb: 'tw:mb-0',
        byline: 'tw:hidden',
        title:
          'tw:absolute tw:inset-x-0 tw:inset-be-0 tw:z-0 tw:rounded-b-thumb tw:bg-linear-to-t tw:from-scrim tw:px-inline tw:pt-section tw:pb-inline tw:text-label tw:text-on-live',
        meta: 'tw:hidden',
        reason: 'tw:hidden',
        menu: 'tw:absolute tw:inset-bs-inline tw:inset-e-inline',
      },
      spotlight: {
        root: 'tw:gap-y-inline',
        thumb: 'tw:max-w-[640px]',
        title: 'tw:text-headline tw:large:text-display',
        meta: 'tw:text-body',
      },
    } satisfies Record<VideoCardVariant, object>,
    state: {
      rest: {},
      live: {},
      premiere: {},
      unavailable: { title: 'tw:text-fg-muted' },
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
      class: { root: 'tw:grid-cols-[120px_minmax(0,1fr)_auto]' },
    },
  ],
  defaultVariants: { variant: 'grid', state: 'rest', size: 'md' },
});
