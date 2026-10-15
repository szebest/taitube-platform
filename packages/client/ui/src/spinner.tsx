import { LoaderCircle } from 'lucide-react';

import type { VariantProps } from 'tailwind-variants';
import { tv } from './class-names';

export const spinnerVariants = tv({
  base: 'tw:shrink-0 tw:animate-spin tw:text-fg-muted tw:motion-reduce:animate-none',
  variants: {
    size: {
      sm: 'tw:size-4',
      md: 'tw:size-6',
      lg: 'tw:size-10',
    },
  },
  defaultVariants: { size: 'md' },
});

export type SpinnerProps = VariantProps<typeof spinnerVariants> & {
  /** What is loading, read out instead of the animation. */
  label: string;
  className?: string;
};

export function Spinner({ label, size, className }: SpinnerProps) {
  return (
    <LoaderCircle
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={spinnerVariants({ size, className })}
    />
  );
}
