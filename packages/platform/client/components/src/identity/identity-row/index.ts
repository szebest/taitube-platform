import {
  IdentityRowAvatar,
  IdentityRowCheck,
  IdentityRowDetail,
  IdentityRowName,
  IdentityRowRoot,
  IdentityRowText,
  IdentityRowUnread,
} from './identity-row';

export const IdentityRow = {
  Root: IdentityRowRoot,
  Avatar: IdentityRowAvatar,
  Text: IdentityRowText,
  Name: IdentityRowName,
  Detail: IdentityRowDetail,
  Unread: IdentityRowUnread,
  Check: IdentityRowCheck,
};
export type { IdentityRowAvatarProps, IdentityRowRootProps } from './identity-row';
export { useIdentityRow } from './identity-row.context';
export { IDENTITY_ITEM, jumpToIdentityItem } from './jump-to-identity-item';
