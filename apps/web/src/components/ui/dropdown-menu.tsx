import { Check, ChevronRight } from 'lucide-react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { type VariantProps, cn, tv } from 'tailwind-variants';

const dropdownMenuItemVariants = tv({
  base: 'tw:relative tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-md tw:px-3 tw:py-2 tw:text-sm tw:outline-none tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:data-highlighted:bg-tint tw:data-[state=open]:bg-tint tw:[&_svg]:size-4 tw:[&_svg]:shrink-0',
  variants: {
    variant: {
      default: '',
      destructive: 'tw:text-danger tw:data-highlighted:bg-danger/10',
    },
  },
  defaultVariants: { variant: 'default' },
});

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
          'tw:z-dropdown tw:max-h-(--radix-dropdown-menu-content-available-height) tw:min-w-40 tw:origin-(--radix-dropdown-menu-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-popover tw:p-1 tw:font-sans tw:text-fg tw:shadow-md tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out tw:motion-reduce:animate-none',
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
          'tw:z-dropdown tw:max-h-(--radix-dropdown-menu-content-available-height) tw:min-w-40 tw:origin-(--radix-dropdown-menu-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-popover tw:p-1 tw:font-sans tw:text-fg tw:shadow-md tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out tw:motion-reduce:animate-none',
          className
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  variant,
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & VariantProps<typeof dropdownMenuItemVariants>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={dropdownMenuItemVariants({ variant, className })}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubTrigger>) {
  return (
    <MenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={dropdownMenuItemVariants({ className })}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden="true" className="tw:ml-auto tw:text-fg-muted" />
    </MenuPrimitive.SubTrigger>
  );
}

function ItemCheck() {
  return (
    <MenuPrimitive.ItemIndicator className="tw:ml-auto tw:inline-flex tw:items-center">
      <Check aria-hidden="true" />
    </MenuPrimitive.ItemIndicator>
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
      className={dropdownMenuItemVariants({ className })}
      {...props}
    >
      {children}
      <ItemCheck />
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
      className={dropdownMenuItemVariants({ className })}
      {...props}
    >
      {children}
      <ItemCheck />
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
      className={cn('tw:-mx-1 tw:my-1 tw:h-px tw:bg-tint-strong', className)}
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
