import { LoaderCircle } from 'lucide-react';

import type { VariantProps } from 'tailwind-variants';
import { tv } from './class-names';
import { useUiCopy } from './copy/ui-copy';

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
  /** What is loading, read out instead of the animation; the UiCopy `loading` word without one. */
  children?: string;
  className?: string;
};

export function Spinner({ children, size, className }: SpinnerProps) {
  const { loading } = useUiCopy();

  return (
    <LoaderCircle
      data-slot="spinner"
      role="status"
      aria-label={children ?? loading}
      className={spinnerVariants({ size, className })}
    />
  );
}
