import { Check, Minus } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from 'tailwind-variants';

import { useFieldControl } from './field';

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  const field = useFieldControl();

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'tw:peer tw:inline-flex tw:size-5 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-sm tw:border tw:border-border-strong tw:bg-surface tw:p-0 tw:text-on-accent tw:transition-colors tw:focus-ring tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-danger tw:data-[state=checked]:border-accent tw:data-[state=checked]:bg-accent tw:data-[state=indeterminate]:border-accent tw:data-[state=indeterminate]:bg-accent',
        className
      )}
      {...field}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="tw:group tw:flex tw:items-center tw:justify-center"
      >
        <Check
          aria-hidden="true"
          className="tw:size-4 tw:group-data-[state=indeterminate]:hidden"
        />
        <Minus
          aria-hidden="true"
          className="tw:hidden tw:size-4 tw:group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
