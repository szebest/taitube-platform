import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

/**
 * `link` is checked on the source channel, `approveLink` and `removeInboundLink` on the target channel;
 * any signed-in viewer may `suggest`, and the source channel's queue decides.
 */
export function defineContentLinkRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;
  const { can } = builder;

  can('suggest', 'ContentLink');
  can(['link', 'approveLink', 'removeInboundLink'], 'ContentLink', { ownerId: user.id });
  can('read', 'ContentLinkStats', { ownerId: user.id });

  const linking = channelsWith(user, 'content.link');
  if (linking) can('link', 'ContentLink', { channelId: linking });
  const approving = channelsWith(user, 'link.approve');
  if (approving) can(['approveLink', 'removeInboundLink'], 'ContentLink', { channelId: approving });
  const readable = channelsWith(user, 'analytics.read');
  if (readable) can('read', 'ContentLinkStats', { channelId: readable });
}
