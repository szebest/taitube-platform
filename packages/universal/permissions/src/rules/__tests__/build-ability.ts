import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility, UserContext } from '../../types/index.js';

type DefineRules = (user: UserContext | null, builder: AbilityBuilder<AppAbility>) => void;

export function buildAbility(define: DefineRules, user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  define(user, builder);
  return builder.build();
}
