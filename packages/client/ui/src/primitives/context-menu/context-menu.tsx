import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import { createMenuParts } from '../dropdown-menu/dropdown-menu';

export const {
  useMenu: useContextMenu,
  Content: ContextMenuContent,
  SubContent: ContextMenuSubContent,
  Item: ContextMenuItem,
  SubTrigger: ContextMenuSubTrigger,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioItem: ContextMenuRadioItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
} = createMenuParts(ContextMenuPrimitive, {
  slot: 'context-menu',
  side: 'inline-end',
  content:
    'tw:max-h-(--radix-context-menu-content-available-height) tw:origin-(--radix-context-menu-content-transform-origin)',
});
