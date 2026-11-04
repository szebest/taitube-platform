import { tv } from '../../lib/class-names';
import type { DrawerSize } from './types';

export const drawerStyles = tv({
  slots: {
    overlay: 'fixed inset-0 z-overlay bg-scrim motion-enter motion-enter-scrim',
    content:
      'fixed inset-x-0 bottom-0 z-modal flex flex-col gap-stack rounded-t-sheet border-t-divider border-border bg-raised px-inset-card pt-inline font-sans text-fg shadow-3 outline-none motion-enter motion-enter-sheet motion-from-bottom',
    handle:
      'mx-auto flex min-h-touch-target w-touch-target shrink-0 cursor-grab touch-none items-center justify-center border-0 bg-transparent p-0 focus-ring active:cursor-grabbing after:h-1 after:w-10 after:rounded-full after:bg-border-strong after:content-[""]',
    title: 'm-0 text-title-lg',
    description: 'm-0 text-body-sm text-fg-muted',
    body: 'min-h-0 flex-1 overflow-y-auto',
    footer:
      'flex flex-col-reverse gap-inline pb-[max(var(--inset-card),env(safe-area-inset-bottom))] medium:flex-row medium:justify-end',
  },
  variants: {
    size: {
      sm: { content: 'max-h-[40dvh]' },
      md: { content: 'max-h-[70dvh]' },
      lg: { content: 'max-h-[92dvh]' },
    } satisfies Record<DrawerSize, object>,
  },
  defaultVariants: { size: 'md' },
});
