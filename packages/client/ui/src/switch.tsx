import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from './class-names';

import { useFieldControl } from './field';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  const field = useFieldControl();

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'tw:peer tw:inline-flex tw:h-6 tw:w-11 tw:shrink-0 tw:cursor-pointer tw:items-center tw:rounded-full tw:border-2 tw:border-transparent tw:bg-border-strong tw:p-0 tw:transition-colors tw:duration-150 tw:focus-ring tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:data-[state=checked]:bg-accent tw:data-[state=checked]:hover:bg-accent-hover tw:motion-reduce:transition-none',
        className
      )}
      {...field}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="tw:pointer-events-none tw:block tw:size-5 tw:rounded-full tw:bg-on-accent tw:shadow-sm tw:transition-transform tw:duration-200 tw:ease-(--vp-ease-out) tw:motion-reduce:transition-none tw:data-[state=checked]:translate-x-5 tw:data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}
