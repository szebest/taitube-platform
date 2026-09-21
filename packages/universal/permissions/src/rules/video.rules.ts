import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, UserContext } from '../types';

export function defineVideoRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  can('read', 'Video', { visibility: 'public' });
  can('read', 'Video', { visibility: 'unlisted' });

  if (!user) {
    return;
  }

  const role = user.role;

  if (role === 'MODERATOR') {
    can('read', 'Video');
  }

  if (role === 'USER' || role === 'CREATOR' || role === 'MODERATOR' || role === 'ADMIN') {
    can('read', 'Video', { ownerId: user.id });

    can('create', 'Video');
    can('react', 'Video');

    can('update', 'Video', { ownerId: user.id });
    can('delete', 'Video', { ownerId: user.id });
  }

  if (role === 'CREATOR' || role === 'MODERATOR') {
    can('publish', 'Video', { ownerId: user.id });
  }
}
