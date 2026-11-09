import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { ownersWith } from './memberships';

export function defineAnalyticsRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('read', 'Analytics', { ownerId: user.id });

  const readable = ownersWith(user, 'analytics.read');
  if (readable) builder.can('read', 'Analytics', { ownerId: readable });
}
