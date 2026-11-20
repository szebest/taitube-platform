import { AbilityBuilder, type MongoAbility, type Subject, createMongoAbility } from '@casl/ability';

export type RuleSet<A extends string, S extends Subject, C> = (
  context: C,
  builder: AbilityBuilder<MongoAbility<[A, S]>>
) => void;

export type AbilityFactory<A extends string, S extends Subject, C> = (
  context: C
) => MongoAbility<[A, S]>;

export function createAbilityFactory<A extends string, S extends Subject, C>(
  ruleSets: readonly RuleSet<A, S, C>[]
): AbilityFactory<A, S, C> {
  return (context) => {
    const builder = new AbilityBuilder<MongoAbility<[A, S]>>(createMongoAbility);
    for (const define of ruleSets) define(context, builder);
    return builder.build();
  };
}
