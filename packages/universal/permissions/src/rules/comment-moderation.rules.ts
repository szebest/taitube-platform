import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

/** Restricting a user and the channel's comment settings: the owner, and members by capability. */
export function defineCommentModerationRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;
  const { can } = builder;

  can('restrict', 'ChannelUser', { ownerId: user.id });
  can('read', 'CommentSettings', { ownerId: user.id });
  can('update', 'CommentSettings', { ownerId: user.id });

  const moderated = channelsWith(user, 'comment.moderate');
  if (moderated) can('restrict', 'ChannelUser', { channelId: moderated });

  const configured = channelsWith(user, 'comment.settings');
  if (configured) {
    can('read', 'CommentSettings', { channelId: configured });
    can('update', 'CommentSettings', { channelId: configured });
  }
}
