import { DropdownMenu } from '@vp/ui';
import { AccountMenuItem, AccountMenuTrigger } from './account-menu';

type MenuParts = Pick<typeof DropdownMenu, 'Root' | 'Content' | 'Label' | 'Separator'>;

export const AccountMenu: MenuParts & {
  Trigger: typeof AccountMenuTrigger;
  Item: typeof AccountMenuItem;
} = {
  Root: DropdownMenu.Root,
  Trigger: AccountMenuTrigger,
  Content: DropdownMenu.Content,
  Label: DropdownMenu.Label,
  Item: AccountMenuItem,
  Separator: DropdownMenu.Separator,
};
export type { AccountMenuTriggerProps } from './account-menu';
