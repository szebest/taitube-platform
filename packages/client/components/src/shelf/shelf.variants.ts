import { tv } from '@vp/ui';
import type { ShelfChevronSide, ShelfVariant } from './types';

export const shelfStyles = tv({
  slots: {
    root: 'group/shelf flex min-w-0 flex-col gap-stack font-sans text-fg',
    header: 'flex flex-wrap items-baseline gap-x-stack gap-y-1',
    title: 'm-0 text-title-lg text-balance',
    note: 'm-0 min-w-0 truncate font-editorial text-editorial text-fg-muted',
    action: 'ms-auto text-label text-accent-ink no-underline focus-ring hover:underline',
    viewport: 'relative',
    track:
      'm-0 -my-inline grid list-none grid-flow-col justify-start gap-shelf overflow-x-auto overscroll-x-contain scroll-smooth p-0 py-inline [scrollbar-width:none] snap-x snap-mandatory scroll-fade focus-ring in-data-[motion=reduced]:scroll-auto',
    item: 'min-w-0 snap-start',
    chevron:
      'absolute inset-bs-1/2 z-1 -translate-y-1/2 bg-raised opacity-0 shadow-2 transition-opacity duration-fast ease-standard group-focus-within/shelf:opacity-100 group-hover/shelf:opacity-100 pointer-coarse:hidden data-hidden:hidden',
  },
  variants: {
    variant: {
      card: {
        track:
          'auto-cols-[clamp(260px,calc(100%-24px),320px)] medium:auto-cols-[clamp(260px,calc((100%-2*var(--gap-shelf))/2.3),320px)] expanded:auto-cols-[clamp(260px,calc((100%-3*var(--gap-shelf))/3.3),320px)] large:auto-cols-[clamp(260px,calc((100%-4*var(--gap-shelf))/4.3),320px)]',
      },
      poster: { track: 'auto-cols-[160px] medium:auto-cols-[180px]' },
      channel: { track: 'auto-cols-[140px]' },
    } satisfies Record<ShelfVariant, object>,
    side: {
      'inline-start': { chevron: 'inset-s-inline' },
      'inline-end': { chevron: 'inset-e-inline' },
    } satisfies Record<ShelfChevronSide, object>,
  },
  defaultVariants: { variant: 'card' },
});
