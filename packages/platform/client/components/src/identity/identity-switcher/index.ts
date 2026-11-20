import {
  IdentitySwitcherAction,
  IdentitySwitcherContent,
  IdentitySwitcherEmpty,
  IdentitySwitcherGroup,
  IdentitySwitcherItem,
  IdentitySwitcherList,
  IdentitySwitcherRoot,
  IdentitySwitcherSearch,
} from './identity-switcher';

export const IdentitySwitcher = {
  Root: IdentitySwitcherRoot,
  Content: IdentitySwitcherContent,
  Search: IdentitySwitcherSearch,
  List: IdentitySwitcherList,
  Empty: IdentitySwitcherEmpty,
  Group: IdentitySwitcherGroup,
  Item: IdentitySwitcherItem,
  Action: IdentitySwitcherAction,
};
export type { IdentitySwitcherContentProps, IdentitySwitcherRootProps } from './identity-switcher';
export { IDENTITY_ITEM, jumpToIdentityItem } from './identity-switcher';
