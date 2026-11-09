import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { ownersWith } from './memberships';

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
    can('heart', 'Comment', { videoOwnerId: user.id });
    can('report', 'Comment');
  }

  if (role === 'MODERATOR') {
    can('delete', 'Comment');
  }

  const moderated = ownersWith(user, 'comment.moderate');
  if (moderated) {
    can('delete', 'Comment', { videoOwnerId: moderated });
    can('moderate', 'Comment', { videoOwnerId: moderated });
  }

  const pinnable = ownersWith(user, 'comment.pin');
  if (pinnable) can('pin', 'Comment', { videoOwnerId: pinnable });

  const heartable = ownersWith(user, 'comment.heart');
  if (heartable) can('heart', 'Comment', { videoOwnerId: heartable });
}
