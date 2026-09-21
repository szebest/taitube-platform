import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, UserContext } from '../types';

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

  if (role === 'USER' || role === 'CREATOR' || role === 'MODERATOR' || role === 'ADMIN') {
    can('create', 'Comment');
    can('delete', 'Comment', { authorId: user.id });
    can('delete', 'Comment', { videoOwnerId: user.id });
    can('pin', 'Comment', { videoOwnerId: user.id });
  }

  if (role === 'MODERATOR') {
    can('delete', 'Comment');
  }
}
