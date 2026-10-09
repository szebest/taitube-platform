import type { ComponentProps } from 'react';

import type { VariantProps } from 'tailwind-variants';
import { tv } from './class-names';

export const separatorVariants = tv({
  base: 'tw:shrink-0 tw:border-0 tw:bg-border',
  variants: {
    orientation: {
      horizontal: 'tw:h-px tw:w-full',
      vertical: 'tw:h-full tw:w-px',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
});

export type SeparatorProps = ComponentProps<'div'> &
  VariantProps<typeof separatorVariants> & {
    /** A purely visual line, which assistive technology skips. */
    decorative?: boolean;
  };

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      data-slot="separator"
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={separatorVariants({ orientation, className })}
      {...props}
    />
  );
}
