import { tv } from '../../lib/class-names';
import type { DrawerSize } from './types';

export const drawerStyles = tv({
  slots: {
    overlay:
      'tw:fixed tw:inset-0 tw:z-overlay tw:bg-scrim tw:data-[state=open]:animate-fade-in tw:data-[state=closed]:animate-fade-out tw:motion-reduce:animate-none',
    content:
      'tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-modal tw:flex tw:flex-col tw:gap-stack tw:rounded-t-sheet tw:border-t-divider tw:border-border tw:bg-raised tw:px-inset-card tw:pt-inline tw:font-sans tw:text-fg tw:shadow-3 tw:outline-none tw:data-[state=open]:animate-slide-in-from-bottom tw:data-[state=closed]:animate-slide-out-to-bottom tw:motion-reduce:animate-none',
    handle:
      'tw:mx-auto tw:flex tw:min-h-touch-target tw:w-touch-target tw:shrink-0 tw:cursor-grab tw:touch-none tw:items-center tw:justify-center tw:border-0 tw:bg-transparent tw:p-0 tw:focus-ring tw:active:cursor-grabbing tw:after:h-1 tw:after:w-10 tw:after:rounded-full tw:after:bg-border-strong tw:after:content-[""]',
    title: 'tw:m-0 tw:text-title-lg',
    description: 'tw:m-0 tw:text-body-sm tw:text-fg-muted',
    body: 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto',
    footer:
      'tw:flex tw:flex-col-reverse tw:gap-inline tw:pb-[max(var(--inset-card),env(safe-area-inset-bottom))] tw:sm:flex-row tw:sm:justify-end',
  },
  variants: {
    size: {
      sm: { content: 'tw:max-h-[40dvh]' },
      md: { content: 'tw:max-h-[70dvh]' },
      lg: { content: 'tw:max-h-[92dvh]' },
    } satisfies Record<DrawerSize, object>,
  },
  defaultVariants: { size: 'md' },
});
