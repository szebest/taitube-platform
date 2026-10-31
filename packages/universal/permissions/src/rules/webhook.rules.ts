import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

export function defineWebhookRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can('create', 'Webhook');
}
