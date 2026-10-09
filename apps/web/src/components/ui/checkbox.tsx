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
        'tw:peer tw:inline-flex tw:size-5 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-sm tw:border tw:border-border-strong tw:bg-surface tw:p-0 tw:text-on-accent tw:transition-colors tw:duration-150 tw:focus-ring tw:hover:border-fg-muted tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-danger tw:data-[state=checked]:border-accent tw:data-[state=checked]:bg-accent tw:data-[state=indeterminate]:border-accent tw:data-[state=indeterminate]:bg-accent tw:motion-reduce:transition-none',
        className
      )}
      {...field}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="tw:group tw:flex tw:items-center tw:justify-center tw:data-[state=checked]:animate-pop-in tw:data-[state=indeterminate]:animate-pop-in tw:motion-reduce:animate-none"
      >
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="tw:size-3.5 tw:group-data-[state=indeterminate]:hidden"
        />
        <Minus
          aria-hidden="true"
          strokeWidth={3}
          className="tw:hidden tw:size-3.5 tw:group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
