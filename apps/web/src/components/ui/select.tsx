import { Check, ChevronDown } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { type VariantProps, cn } from 'tailwind-variants';

import { controlVariants, useFieldControl } from './field';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> &
  Pick<VariantProps<typeof controlVariants>, 'size'>;

export function SelectTrigger({ size, className, children, ...props }: SelectTriggerProps) {
  const field = useFieldControl();

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={controlVariants({ kind: 'select', size, className })}
      {...field}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          'tw:relative tw:z-dropdown tw:max-h-(--radix-select-content-available-height) tw:min-w-(--radix-select-trigger-width) tw:origin-(--radix-select-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-surface-elevated tw:p-1 tw:font-sans tw:text-fg tw:shadow-md tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out tw:motion-reduce:animate-none',
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:rounded-sm tw:py-2 tw:pr-8 tw:pl-3 tw:text-sm tw:outline-none tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:data-highlighted:bg-surface-hover',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="tw:absolute tw:right-2 tw:inline-flex tw:items-center tw:justify-center">
        <Check aria-hidden="true" className="tw:size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('tw:px-3 tw:py-1.5 tw:text-xs tw:text-fg-muted', className)}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('tw:-mx-1 tw:my-1 tw:h-px tw:bg-border', className)}
      {...props}
    />
  );
}
