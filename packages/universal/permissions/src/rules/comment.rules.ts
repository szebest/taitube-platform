import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

const MODERATION_ACTIONS = ['hold', 'approve', 'hide', 'unhide', 'remove'] as const;

export function defineCommentRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  can('read', 'Comment');

  if (!user) {
    return;
  }

  const role = user.role;

  if (isSignedInRole(role)) {
    can('create', 'Comment');
    can('update', 'Comment', { authorId: user.id });
    can('delete', 'Comment', { authorId: user.id });
    can('delete', 'Comment', { videoOwnerId: user.id });
    can('moderate', 'Comment', { videoOwnerId: user.id });
    can('pin', 'Comment', { videoOwnerId: user.id });
    for (const action of MODERATION_ACTIONS) can(action, 'Comment', { videoOwnerId: user.id });
    can('heart', 'Comment', { videoOwnerId: user.id });
    can('report', 'Comment');
  }

  if (role === 'MODERATOR') {
    can('delete', 'Comment');
  }

  const moderated = channelsWith(user, 'comment.moderate');
  if (moderated) {
    can('delete', 'Comment', { videoChannelId: moderated });
    can('moderate', 'Comment', { videoChannelId: moderated });
    for (const action of MODERATION_ACTIONS) can(action, 'Comment', { videoChannelId: moderated });
  }

  const pinnable = channelsWith(user, 'comment.pin');
  if (pinnable) can('pin', 'Comment', { videoChannelId: pinnable });

  const heartable = channelsWith(user, 'comment.heart');
  if (heartable) can('heart', 'Comment', { videoChannelId: heartable });
}
