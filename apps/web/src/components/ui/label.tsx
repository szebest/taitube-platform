import type { ComponentProps } from 'react';
import { cn } from 'tailwind-variants';

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller passes htmlFor, or Field does
    <label
      data-slot="label"
      className={cn(
        'tw:font-sans tw:text-sm tw:font-medium tw:text-fg tw:select-none tw:peer-disabled:cursor-not-allowed tw:peer-disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
