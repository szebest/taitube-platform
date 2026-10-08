import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { type VariantProps, cn, tv } from 'tailwind-variants';

const dropdownMenuItemVariants = tv({
  base: 'tw:relative tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-sm tw:px-3 tw:py-2 tw:text-sm tw:outline-none tw:select-none tw:focus-ring tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:data-highlighted:bg-surface-hover tw:[&_svg]:size-4 tw:[&_svg]:shrink-0',
  variants: {
    variant: {
      default: '',
      destructive:
        'tw:text-danger tw:data-highlighted:bg-danger tw:data-highlighted:text-on-danger',
    },
    /** Lines the text up with the checkbox and radio items' text. */
    inset: {
      true: 'tw:pl-9',
    },
  },
  defaultVariants: { variant: 'default' },
});

type ItemVariants = VariantProps<typeof dropdownMenuItemVariants>;

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;
export const DropdownMenuSub = MenuPrimitive.Sub;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'tw:z-dropdown tw:max-h-(--radix-dropdown-menu-content-available-height) tw:min-w-40 tw:origin-(--radix-dropdown-menu-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-surface-elevated tw:p-1 tw:font-sans tw:text-fg tw:shadow-md tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out tw:motion-reduce:animate-none',
          className
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        className={cn(
          'tw:z-dropdown tw:max-h-(--radix-dropdown-menu-content-available-height) tw:min-w-40 tw:origin-(--radix-dropdown-menu-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-surface-elevated tw:p-1 tw:font-sans tw:text-fg tw:shadow-md tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out tw:motion-reduce:animate-none',
          className
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  variant,
  inset,
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & ItemVariants) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={dropdownMenuItemVariants({ variant, inset, className })}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  inset,
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubTrigger> & Pick<ItemVariants, 'inset'>) {
  return (
    <MenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={dropdownMenuItemVariants({ inset, className })}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden="true" className="tw:ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={dropdownMenuItemVariants({ inset: true, className })}
      {...props}
    >
      <MenuPrimitive.ItemIndicator className="tw:absolute tw:left-3 tw:inline-flex tw:items-center tw:justify-center">
        <Check aria-hidden="true" />
      </MenuPrimitive.ItemIndicator>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={dropdownMenuItemVariants({ inset: true, className })}
      {...props}
    >
      <MenuPrimitive.ItemIndicator className="tw:absolute tw:left-3 tw:inline-flex tw:size-4 tw:items-center tw:justify-center">
        <span className="tw:size-2 tw:rounded-full tw:bg-current" />
      </MenuPrimitive.ItemIndicator>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn('tw:px-3 tw:py-1.5 tw:text-xs tw:text-fg-muted', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('tw:-mx-1 tw:my-1 tw:h-px tw:bg-border', className)}
      {...props}
    />
  );
}

/** The keyboard shortcut an item answers to, shown at its end. */
export function DropdownMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('tw:ml-auto tw:text-xs tw:tracking-widest tw:text-fg-muted', className)}
      {...props}
    />
  );
}
