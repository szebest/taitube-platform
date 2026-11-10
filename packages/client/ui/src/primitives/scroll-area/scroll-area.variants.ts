import { tv } from '../../lib/class-names';
import type { ScrollAreaSize } from './types';

export const scrollAreaStyles = tv({
  slots: {
    root: 'relative overflow-hidden',
    viewport: 'size-full rounded-[inherit] focus-ring',
    scrollbar:
      'flex touch-none p-px transition-colors duration-fast ease-standard data-[orientation=horizontal]:flex-col',
    thumb: 'relative flex-1 rounded-chip bg-border-strong hover:bg-fg-muted active:bg-fg-muted',
  },
  variants: {
    size: {
      sm: {
        scrollbar: 'data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5',
      },
      md: {
        scrollbar: 'data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:w-2.5',
      },
    } satisfies Record<ScrollAreaSize, object>,
    fade: { true: { viewport: 'scroll-fade' } },
  },
  defaultVariants: { size: 'md' },
});
