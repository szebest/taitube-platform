import type { ComponentProps } from 'react';

import { type VariantProps, tv } from 'tailwind-variants';
import { useFieldControl } from './field';

export const progressVariants = tv({
  base: 'tw:block tw:w-full tw:appearance-none tw:overflow-hidden tw:rounded-full tw:border-0 tw:bg-surface-hover tw:[&::-moz-progress-bar]:bg-accent tw:[&::-webkit-progress-bar]:bg-transparent tw:[&::-webkit-progress-value]:bg-accent tw:[&::-webkit-progress-value]:transition-[width] tw:motion-reduce:[&::-webkit-progress-value]:transition-none',
  variants: {
    size: {
      sm: 'tw:h-1',
      md: 'tw:h-2',
    },
  },
  defaultVariants: { size: 'md' },
});

/** The native `<progress>`: without `value` it is indeterminate. */
export type ProgressProps = Omit<ComponentProps<'progress'>, 'children'> &
  VariantProps<typeof progressVariants>;

export function Progress({ size, className, ...props }: ProgressProps) {
  const field = useFieldControl();

  return (
    <progress
      data-slot="progress"
      className={progressVariants({ size, className })}
      {...field}
      {...props}
    />
  );
}
