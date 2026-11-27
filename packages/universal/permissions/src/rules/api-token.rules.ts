import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';

/** No scope grants `ApiToken`, so a request made with a token never manages tokens. */
export function defineApiTokenRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can(['create', 'read', 'delete'], 'ApiToken', { userId: user.id });
}
