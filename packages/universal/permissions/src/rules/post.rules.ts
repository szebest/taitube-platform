import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

/** Writing a post is the channel's; reading one is a rule of its status, not an ability. */
export function definePostRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;
  const { can } = builder;

  can('react', 'Post');
  can(['create', 'update', 'delete', 'pin'], 'Post', { ownerId: user.id });
  can('read', 'PostStats', { ownerId: user.id });

  const writable = channelsWith(user, 'post.manage');
  if (writable) can(['create', 'update', 'delete'], 'Post', { channelId: writable });
  const pinnable = channelsWith(user, 'content.pin');
  if (pinnable) can('pin', 'Post', { channelId: pinnable });
  const readable = channelsWith(user, 'analytics.read');
  if (readable) can('read', 'PostStats', { channelId: readable });
}
