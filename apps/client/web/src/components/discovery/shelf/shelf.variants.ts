import { tv } from '@vp/ui';
import type { ShelfChevronSide, ShelfVariant } from './types';

export const shelfStyles = tv({
  slots: {
    root: 'tw:group/shelf tw:flex tw:min-w-0 tw:flex-col tw:gap-stack tw:font-sans tw:text-fg',
    header: 'tw:flex tw:flex-wrap tw:items-baseline tw:gap-x-stack tw:gap-y-1',
    title: 'tw:m-0 tw:text-title-lg tw:text-balance',
    note: 'tw:m-0 tw:min-w-0 tw:truncate tw:font-editorial tw:text-editorial tw:text-fg-muted',
    action:
      'tw:ms-auto tw:text-label tw:text-accent-ink tw:no-underline tw:focus-ring tw:hover:underline',
    viewport: 'tw:relative',
    track:
      'tw:m-0 tw:-my-inline tw:grid tw:list-none tw:grid-flow-col tw:justify-start tw:gap-shelf tw:overflow-x-auto tw:overscroll-x-contain tw:scroll-smooth tw:p-0 tw:py-inline tw:[scrollbar-width:none] tw:snap-x tw:snap-mandatory tw:scroll-fade tw:focus-ring tw:in-data-[motion=reduced]:scroll-auto',
    item: 'tw:min-w-0 tw:snap-start',
    chevron:
      'tw:absolute tw:inset-bs-1/2 tw:z-1 tw:-translate-y-1/2 tw:bg-raised tw:opacity-0 tw:shadow-2 tw:transition-opacity tw:duration-fast tw:ease-standard tw:group-focus-within/shelf:opacity-100 tw:group-hover/shelf:opacity-100 tw:pointer-coarse:hidden tw:data-hidden:hidden',
  },
  variants: {
    variant: {
      card: {
        track:
          'tw:auto-cols-[clamp(260px,calc(100%-24px),320px)] tw:medium:auto-cols-[clamp(260px,calc((100%-2*var(--gap-shelf))/2.3),320px)] tw:expanded:auto-cols-[clamp(260px,calc((100%-3*var(--gap-shelf))/3.3),320px)] tw:large:auto-cols-[clamp(260px,calc((100%-4*var(--gap-shelf))/4.3),320px)]',
      },
      poster: { track: 'tw:auto-cols-[160px] tw:medium:auto-cols-[180px]' },
      channel: { track: 'tw:auto-cols-[140px]' },
    } satisfies Record<ShelfVariant, object>,
    side: {
      'inline-start': { chevron: 'tw:inset-s-inline' },
      'inline-end': { chevron: 'tw:inset-e-inline' },
    } satisfies Record<ShelfChevronSide, object>,
  },
  defaultVariants: { variant: 'card' },
});
