import { tv } from '../../lib/class-names';
import type { ScrollAreaSize } from './types';

export const scrollAreaStyles = tv({
  slots: {
    root: 'tw:relative tw:overflow-hidden',
    viewport: 'tw:size-full tw:rounded-[inherit] tw:focus-ring',
    scrollbar:
      'tw:flex tw:touch-none tw:p-px tw:select-none tw:data-[orientation=horizontal]:flex-col',
    thumb:
      'tw:relative tw:flex-1 tw:rounded-chip tw:bg-border-strong tw:hover:bg-fg-muted tw:active:bg-fg-muted',
  },
  variants: {
    size: {
      sm: {
        scrollbar: 'tw:data-[orientation=horizontal]:h-1.5 tw:data-[orientation=vertical]:w-1.5',
      },
      md: {
        scrollbar: 'tw:data-[orientation=horizontal]:h-2.5 tw:data-[orientation=vertical]:w-2.5',
      },
    } satisfies Record<ScrollAreaSize, object>,
    fade: { true: { viewport: 'tw:scroll-fade' } },
  },
  defaultVariants: { size: 'md' },
});
