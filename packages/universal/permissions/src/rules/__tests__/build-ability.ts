import { type RuleSet, createAbilityFactory } from '@kit/permissions';
import type { AppAbility, AppAction, AppSubjects, UserContext } from '../../types/index';

export function buildAbility(
  define: RuleSet<AppAction, AppSubjects, UserContext | null>,
  user: UserContext | null
): AppAbility {
  return createAbilityFactory([define])(user);
}
