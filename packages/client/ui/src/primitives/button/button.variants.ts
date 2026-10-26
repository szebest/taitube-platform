import { tv } from '../../lib/class-names';
import { variantNames } from '../../lib/variant-names';
import type { ButtonFill, ButtonShape, ButtonSize, ButtonTone } from './types';

const FILL_TONES = {
  solid: {
    neutral: 'tw:bg-fg tw:text-bg tw:hover:bg-fg/85',
    accent: 'tw:bg-accent tw:text-on-accent tw:hover:bg-accent-hover',
    danger: 'tw:bg-danger tw:text-on-live tw:hover:bg-danger/90',
  },
  soft: {
    neutral: 'tw:bg-tint tw:text-fg tw:hover:bg-tint-strong',
    accent: 'tw:bg-accent-soft tw:text-accent-ink tw:hover:bg-tint-strong',
    danger: 'tw:bg-tint tw:text-danger-ink tw:hover:bg-tint-strong',
  },
  outline: {
    neutral: 'tw:text-fg tw:hover:bg-tint',
    accent: 'tw:text-accent-ink tw:hover:bg-accent-soft',
    danger: 'tw:text-danger-ink tw:hover:bg-tint',
  },
  ghost: {
    neutral: 'tw:text-fg tw:hover:bg-tint tw:active:bg-tint-strong',
    accent: 'tw:text-accent-ink tw:hover:bg-accent-soft',
    danger: 'tw:text-danger-ink tw:hover:bg-tint',
  },
} satisfies Record<ButtonFill, Record<ButtonTone, string>>;

export const buttonStyles = tv({
  base: 'tw:group/button tw:relative tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-inline tw:border-0 tw:font-sans tw:text-label tw:whitespace-nowrap tw:no-underline tw:transition tw:duration-fast tw:ease-standard tw:select-none tw:touch-target tw:focus-ring tw:active:scale-97 tw:motion-reduce:transition-none tw:motion-reduce:active:scale-100 tw:disabled:cursor-not-allowed tw:disabled:bg-tint tw:disabled:text-fg-subtle tw:disabled:active:scale-100 tw:aria-disabled:cursor-not-allowed tw:aria-disabled:bg-tint tw:aria-disabled:text-fg-subtle tw:aria-busy:cursor-progress tw:aria-pressed:bg-accent-soft tw:aria-pressed:text-accent-ink tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0',
  variants: {
    variant: {
      solid: '',
      soft: '',
      outline: 'tw:border-control tw:border-border-strong tw:bg-transparent',
      ghost: 'tw:bg-transparent tw:disabled:bg-transparent tw:aria-disabled:bg-transparent',
    } satisfies Record<ButtonFill, string>,
    tone: { neutral: '', accent: '', danger: '' } satisfies Record<ButtonTone, string>,
    size: {
      sm: 'tw:h-control-sm tw:[&_svg]:size-icon-sm',
      md: 'tw:h-control-md tw:[&_svg]:size-icon-md',
      lg: 'tw:h-control-lg tw:[&_svg]:size-icon-md',
    } satisfies Record<ButtonSize, string>,
    shape: {
      text: 'tw:rounded-control tw:px-inset-control',
      icon: 'tw:aspect-square tw:rounded-control tw:p-0',
      pill: 'tw:rounded-full tw:px-inset-control',
    } satisfies Record<ButtonShape, string>,
  },
  compoundVariants: [
    ...variantNames(FILL_TONES).flatMap((variant) =>
      variantNames(FILL_TONES[variant]).map((tone) => ({
        variant,
        tone,
        class: FILL_TONES[variant][tone],
      }))
    ),
    { shape: 'icon', size: 'lg', class: 'tw:[&_svg]:size-icon-lg' },
  ],
  defaultVariants: { variant: 'soft', tone: 'neutral', size: 'md', shape: 'text' },
});
