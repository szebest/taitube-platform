import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';

export function defineClipRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('create', 'Clip', { visibility: 'public' });
  builder.can('delete', 'Clip', { userId: user.id });
}
