import { tv } from '../../lib/class-names';
import { variantNames } from '../../lib/variant-names';
import type { ButtonFill, ButtonShape, ButtonSize, ButtonTone } from './types';

const FILL_TONES = {
  solid: {
    neutral: 'bg-fg text-bg hover:bg-fg/85',
    accent: 'bg-accent text-on-accent hover:bg-accent-hover',
    danger: 'bg-danger text-on-live hover:bg-danger/90',
  },
  soft: {
    neutral: 'bg-tint text-fg hover:bg-tint-strong',
    accent: 'bg-accent-soft text-accent-ink hover:bg-tint-strong',
    danger: 'bg-tint text-danger-ink hover:bg-tint-strong',
  },
  outline: {
    neutral: 'text-fg hover:bg-tint',
    accent: 'text-accent-ink hover:bg-accent-soft',
    danger: 'text-danger-ink hover:bg-tint',
  },
  ghost: {
    neutral: 'text-fg hover:bg-tint active:bg-tint-strong',
    accent: 'text-accent-ink hover:bg-accent-soft',
    danger: 'text-danger-ink hover:bg-tint',
  },
} satisfies Record<ButtonFill, Record<ButtonTone, string>>;

export const buttonStyles = tv({
  base: 'group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-inline border-0 font-sans text-label whitespace-nowrap no-underline transition duration-fast ease-standard select-none touch-target focus-ring active:scale-97 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:bg-tint disabled:text-fg-subtle disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:bg-tint aria-disabled:text-fg-subtle aria-busy:cursor-progress aria-pressed:bg-accent-soft aria-pressed:text-accent-ink [&_svg]:pointer-events-none [&_svg]:shrink-0',
  variants: {
    variant: {
      solid: '',
      soft: '',
      outline: 'border-control border-border-strong bg-transparent',
      ghost: 'bg-transparent disabled:bg-transparent aria-disabled:bg-transparent',
    } satisfies Record<ButtonFill, string>,
    tone: { neutral: '', accent: '', danger: '' } satisfies Record<ButtonTone, string>,
    size: {
      sm: 'h-control-sm [&_svg]:size-icon-sm',
      md: 'h-control-md [&_svg]:size-icon-md',
      lg: 'h-control-lg [&_svg]:size-icon-md',
    } satisfies Record<ButtonSize, string>,
    shape: {
      text: 'rounded-control px-inset-control',
      icon: 'aspect-square rounded-control p-0',
      pill: 'rounded-full px-inset-control',
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
    { shape: 'icon', size: 'lg', class: '[&_svg]:size-icon-lg' },
  ],
  defaultVariants: { variant: 'soft', tone: 'neutral', size: 'md', shape: 'text' },
});
