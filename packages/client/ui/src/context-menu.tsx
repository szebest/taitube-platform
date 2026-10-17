import { ContextMenu as MenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'tailwind-variants';

import { panelVariants } from './panel';

const menu = panelVariants({ kind: 'context-menu' });

export const ContextMenu = MenuPrimitive.Root;
export const ContextMenuTrigger = MenuPrimitive.Trigger;
export const ContextMenuGroup = MenuPrimitive.Group;

export function ContextMenuContent({
  className,
  container,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content> &
  Pick<ComponentProps<typeof MenuPrimitive.Portal>, 'container'>) {
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Content
        data-slot="context-menu-content"
        className={menu.content({ className })}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  variant,
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> &
  Pick<VariantProps<typeof panelVariants>, 'variant'>) {
  return (
    <MenuPrimitive.Item
      data-slot="context-menu-item"
      className={panelVariants({ kind: 'context-menu', variant }).item({ className })}
      {...props}
    />
  );
}

export function ContextMenuLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      data-slot="context-menu-label"
      className={menu.label({ className })}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={menu.separator({ className })}
      {...props}
    />
  );
}
