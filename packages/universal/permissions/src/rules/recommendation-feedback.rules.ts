import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, isSignedInRole, type UserContext } from '../types/index';

export function defineRecommendationFeedbackRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;

  builder.can(['read', 'create', 'delete'], 'RecommendationFeedback', { ownerId: user.id });
}
