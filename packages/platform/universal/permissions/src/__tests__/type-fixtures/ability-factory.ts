import { type RuleSet, createAbilityFactory } from '../../index';

type Action = 'read' | 'edit';
type Subject = 'Video' | 'Comment';
interface Context {
  readonly userId: string;
}

const rules: RuleSet<Action, Subject, Context> = (_context, { can }) => {
  can('read', 'Video');
  can('edit', 'Comment');
};

const abilityFor = createAbilityFactory([rules]);
const ability = abilityFor({ userId: 'u1' });

expectTypeOf(abilityFor).parameter(0).toEqualTypeOf<Context>();
expectTypeOf(ability.can).toBeFunction();

// @ts-expect-error the context is the one the rules were written for
abilityFor({ id: 'u1' });

// @ts-expect-error an action outside the set
ability.can('delete', 'Video');

// @ts-expect-error a subject outside the set
ability.can('read', 'Playlist');

const _badRules: RuleSet<Action, Subject, Context> = (_context, { can }) => {
  // @ts-expect-error a rule on an action the set does not have
  can('delete', 'Video');
};
