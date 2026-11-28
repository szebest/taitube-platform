import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { ContentLinkResource, UserContext } from '../types/index';

export type ContentLinkAction = 'link' | 'approveLink' | 'removeInboundLink';

export function canActOnContentLink({
  user,
  action,
  channel,
}: {
  user: UserContext | null;
  action: ContentLinkAction;
  channel: ContentLinkResource;
}): boolean {
  return getUserPermissions(user).can(action, subject('ContentLink', { ...channel }));
}

export function canSuggestContentLink({ user }: { user: UserContext | null }): boolean {
  return getUserPermissions(user).can('suggest', 'ContentLink');
}

export function canReadContentLinkStats({
  user,
  channel,
}: {
  user: UserContext | null;
  channel: ContentLinkResource;
}): boolean {
  return getUserPermissions(user).can('read', subject('ContentLinkStats', { ...channel }));
}
