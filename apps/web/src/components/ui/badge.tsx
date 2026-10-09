import type { ComponentProps } from 'react';

import { type VariantProps, tv } from 'tailwind-variants';

export const badgeVariants = tv({
  base: 'tw:inline-flex tw:items-center tw:gap-1 tw:rounded-sm tw:border tw:border-transparent tw:px-1.5 tw:py-0.5 tw:font-sans tw:text-xs tw:font-medium tw:whitespace-nowrap tw:[&_svg]:size-3',
  variants: {
    variant: {
      neutral: 'tw:bg-tint tw:text-fg',
      accent: 'tw:bg-accent tw:text-on-accent',
      outline: 'tw:border-border-strong tw:text-fg',
      success: 'tw:bg-success/10 tw:text-success',
      warning: 'tw:bg-warning/10 tw:text-warning',
      danger: 'tw:bg-danger/10 tw:text-danger',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ variant, className, ...props }: BadgeProps) {
  return <span data-slot="badge" className={badgeVariants({ variant, className })} {...props} />;
}
