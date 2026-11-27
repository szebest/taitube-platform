import { tv } from '../../lib/class-names';
import type { SliderSize, SliderTone } from './types';

export const sliderStyles = tv({
  slots: {
    root: 'relative flex touch-none items-center data-[orientation=horizontal]:h-icon-md data-[orientation=horizontal]:w-full data-[orientation=vertical]:min-h-32 data-[orientation=vertical]:w-icon-md data-[orientation=vertical]:flex-col data-disabled:opacity-60',
    track:
      'relative grow overflow-hidden rounded-chip bg-tint-strong data-[orientation=vertical]:h-full',
    range:
      'absolute rounded-chip data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full data-disabled:bg-fg-subtle',
    thumb:
      'block size-icon-md rounded-full border-0 bg-fg shadow-1 transition-transform duration-fast touch-target focus-ring active:scale-115 data-disabled:bg-fg-subtle motion-reduce:transition-none motion-reduce:active:scale-100',
  },
  variants: {
    size: {
      sm: { track: 'data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1' },
      md: { track: 'data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5' },
      lg: { track: 'data-[orientation=horizontal]:h-2 data-[orientation=vertical]:w-2' },
    } satisfies Record<SliderSize, object>,
    tone: {
      accent: { range: 'bg-accent' },
      neutral: { range: 'bg-fg' },
    } satisfies Record<SliderTone, object>,
  },
  defaultVariants: { size: 'md', tone: 'accent' },
});
