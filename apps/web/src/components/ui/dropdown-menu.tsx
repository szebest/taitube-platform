import { Check, ChevronRight } from 'lucide-react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { type VariantProps, cn } from 'tailwind-variants';

import { panelVariants } from './panel';

const menu = panelVariants({ kind: 'menu' });

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
        className={menu.content({ className })}
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
        className={menu.content({ className })}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  variant,
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> &
  Pick<VariantProps<typeof panelVariants>, 'variant'>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={panelVariants({ kind: 'menu', variant }).item({ className })}
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
      className={menu.item({ className })}
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
      className={menu.item({ className })}
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
      className={menu.item({ className })}
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
      className={menu.label({ className })}
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
      className={menu.separator({ className })}
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
