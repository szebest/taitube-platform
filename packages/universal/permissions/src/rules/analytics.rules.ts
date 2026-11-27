import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

export function defineAnalyticsRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('read', ['Analytics', 'VideoStats'], { ownerId: user.id });

  const readable = channelsWith(user, 'analytics.read');
  if (readable) builder.can('read', ['Analytics', 'VideoStats'], { channelId: readable });
}
