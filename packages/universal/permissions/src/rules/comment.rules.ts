import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';

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
    can('pin', 'Comment', { videoOwnerId: user.id });
  }

  if (role === 'MODERATOR') {
    can('delete', 'Comment');
  }
}
