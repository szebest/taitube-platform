import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { cn } from '../../lib/class-names';
import { createCompoundContext } from '../../lib/create-compound-context';
import { usePhysicalSide } from '../../lib/physical-side';
import type { PortalContainer } from '../../portal-container';
import type { Align, Side } from '../../types';
import { Icon } from '../icon';
import { menuStyles } from './dropdown-menu.variants';
import type { MenuSize, MenuTone } from './types';

type MenuPrimitive = Pick<
  typeof DropdownMenuPrimitive,
  | 'Portal'
  | 'Content'
  | 'SubContent'
  | 'Item'
  | 'SubTrigger'
  | 'CheckboxItem'
  | 'RadioItem'
  | 'ItemIndicator'
  | 'Label'
  | 'Separator'
>;

type Part<Name extends keyof MenuPrimitive> = ComponentPropsWithRef<MenuPrimitive[Name]>;

export type MenuSubContentProps = Part<'SubContent'> & PortalContainer;
export type MenuSubTriggerProps = Part<'SubTrigger'>;
export type MenuCheckboxItemProps = Part<'CheckboxItem'>;
export type MenuRadioItemProps = Part<'RadioItem'>;
export type MenuLabelProps = Part<'Label'>;
export type MenuSeparatorProps = Part<'Separator'>;

export interface MenuContentProps extends Omit<Part<'Content'>, 'side' | 'align'>, PortalContainer {
  size?: MenuSize;
  side?: Side;
  align?: Align;
}

export interface MenuItemProps extends Part<'Item'> {
  tone?: MenuTone;
}

/**
 * The parts a dropdown menu and a context menu share: only the trigger and the placement differ.
 * `slot` prefixes each part's `data-slot`, `side` is where the content opens by default and `content`
 * the classes tied to the primitive's own CSS variables.
 */
export function createMenuParts(
  Menu: MenuPrimitive,
  { slot, side: defaultSide, content }: { slot: string; side: Side; content: string }
) {
  const [MenuContext, useMenu] = createCompoundContext<{ size: MenuSize }>(slot);

  function Content({
    size = 'md',
    side = defaultSide,
    align = 'start',
    sideOffset = 4,
    collisionPadding = 8,
    container,
    className,
    ...props
  }: MenuContentProps) {
    const shared = useMemo(() => ({ size }), [size]);

    return (
      <MenuContext value={shared}>
        <Menu.Portal container={container}>
          <Menu.Content
            data-slot={`${slot}-content`}
            side={usePhysicalSide(side)}
            align={align}
            sideOffset={sideOffset}
            collisionPadding={collisionPadding}
            className={menuStyles(shared).content({ className: cn(content, className) })}
            {...props}
          />
        </Menu.Portal>
      </MenuContext>
    );
  }

  function SubContent({ container, className, ...props }: MenuSubContentProps) {
    const shared = useMenu('SubContent');

    return (
      <Menu.Portal container={container}>
        <Menu.SubContent
          data-slot={`${slot}-sub-content`}
          className={menuStyles(shared).content({ className })}
          {...props}
        />
      </Menu.Portal>
    );
  }

  function Item({ tone, className, ...props }: MenuItemProps) {
    const shared = useMenu('Item');

    return (
      <Menu.Item
        data-slot={`${slot}-item`}
        className={menuStyles({ ...shared, tone }).item({ className })}
        {...props}
      />
    );
  }

  function SubTrigger({ className, children, ...props }: MenuSubTriggerProps) {
    const shared = useMenu('SubTrigger');

    return (
      <Menu.SubTrigger
        data-slot={`${slot}-sub-trigger`}
        className={menuStyles(shared).item({ className })}
        {...props}
      >
        {children}
        <Icon name="chevron-right" size="sm" className="tw:ms-auto tw:text-fg-muted" />
      </Menu.SubTrigger>
    );
  }

  function CheckboxItem({ className, children, ...props }: MenuCheckboxItemProps) {
    const shared = useMenu('CheckboxItem');
    const styles = menuStyles(shared);

    return (
      <Menu.CheckboxItem
        data-slot={`${slot}-checkbox-item`}
        className={styles.item({ className })}
        {...props}
      >
        {children}
        <Menu.ItemIndicator className={styles.indicator()}>
          <Icon name="check" size="sm" />
        </Menu.ItemIndicator>
      </Menu.CheckboxItem>
    );
  }

  function RadioItem({ className, children, ...props }: MenuRadioItemProps) {
    const shared = useMenu('RadioItem');
    const styles = menuStyles(shared);

    return (
      <Menu.RadioItem
        data-slot={`${slot}-radio-item`}
        className={styles.item({ className })}
        {...props}
      >
        {children}
        <Menu.ItemIndicator className={styles.indicator()}>
          <Icon name="check" size="sm" />
        </Menu.ItemIndicator>
      </Menu.RadioItem>
    );
  }

  function Label({ className, ...props }: MenuLabelProps) {
    return (
      <Menu.Label
        data-slot={`${slot}-label`}
        className={menuStyles().label({ className })}
        {...props}
      />
    );
  }

  function Separator({ className, ...props }: MenuSeparatorProps) {
    return (
      <Menu.Separator
        data-slot={`${slot}-separator`}
        className={menuStyles().separator({ className })}
        {...props}
      />
    );
  }

  function Shortcut({ className, ...props }: ComponentPropsWithRef<'span'>) {
    return (
      <span
        data-slot={`${slot}-shortcut`}
        className={menuStyles().shortcut({ className })}
        {...props}
      />
    );
  }

  return {
    useMenu,
    Content,
    SubContent,
    Item,
    SubTrigger,
    CheckboxItem,
    RadioItem,
    Label,
    Separator,
    Shortcut,
  };
}

export const {
  useMenu: useDropdownMenu,
  Content: DropdownMenuContent,
  SubContent: DropdownMenuSubContent,
  Item: DropdownMenuItem,
  SubTrigger: DropdownMenuSubTrigger,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioItem: DropdownMenuRadioItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
} = createMenuParts(DropdownMenuPrimitive, {
  slot: 'dropdown-menu',
  side: 'block-end',
  content:
    'tw:max-h-(--radix-dropdown-menu-content-available-height) tw:origin-(--radix-dropdown-menu-content-transform-origin)',
});
