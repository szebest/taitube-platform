import { tv } from '../../lib/class-names';
import type { SliderSize, SliderTone } from './types';

export const sliderStyles = tv({
  slots: {
    root: 'tw:relative tw:flex tw:touch-none tw:items-center tw:select-none tw:data-[orientation=horizontal]:h-icon-md tw:data-[orientation=horizontal]:w-full tw:data-[orientation=vertical]:min-h-32 tw:data-[orientation=vertical]:w-icon-md tw:data-[orientation=vertical]:flex-col tw:data-disabled:opacity-60',
    track:
      'tw:relative tw:grow tw:overflow-hidden tw:rounded-chip tw:bg-tint-strong tw:data-[orientation=vertical]:h-full',
    range:
      'tw:absolute tw:rounded-chip tw:data-[orientation=horizontal]:h-full tw:data-[orientation=vertical]:w-full tw:data-disabled:bg-fg-subtle',
    thumb:
      'tw:block tw:size-icon-md tw:rounded-full tw:border-0 tw:bg-fg tw:shadow-1 tw:transition-transform tw:duration-fast tw:touch-target tw:focus-ring tw:active:scale-115 tw:data-disabled:bg-fg-subtle tw:motion-reduce:transition-none tw:motion-reduce:active:scale-100',
  },
  variants: {
    size: {
      sm: { track: 'tw:data-[orientation=horizontal]:h-1 tw:data-[orientation=vertical]:w-1' },
      md: { track: 'tw:data-[orientation=horizontal]:h-1.5 tw:data-[orientation=vertical]:w-1.5' },
      lg: { track: 'tw:data-[orientation=horizontal]:h-2 tw:data-[orientation=vertical]:w-2' },
    } satisfies Record<SliderSize, object>,
    tone: {
      accent: { range: 'tw:bg-accent' },
      neutral: { range: 'tw:bg-fg' },
    } satisfies Record<SliderTone, object>,
  },
  defaultVariants: { size: 'md', tone: 'accent' },
});
