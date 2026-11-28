import { type RuleSet, createAbilityFactory } from '../../ability-factory';
import { type AbilityProbe, describeAbilityFactoryContract } from '../../contract';

interface Context {
  readonly role: 'viewer' | 'editor';
}

const rules: RuleSet<'read' | 'edit', 'Video', Context> = (_context, { can }) => {
  can('read', 'Video');
};

const viewer: AbilityProbe<Context> = {
  context: { role: 'viewer' },
  granted: [['read', 'Video']],
  denied: [['edit', 'Video']],
};

expectTypeOf(describeAbilityFactoryContract<Context>)
  .parameter(1)
  .toEqualTypeOf<readonly AbilityProbe<Context>[]>();

describeAbilityFactoryContract(() => createAbilityFactory([rules]), [viewer]);

describeAbilityFactoryContract(
  () => createAbilityFactory([rules]),
  [
    // @ts-expect-error a probe carries the context the factory was written for
    { context: { userId: 'u1' }, granted: [], denied: [] },
  ]
);

// @ts-expect-error a probe names a subject as a string or an object, never a number
const _badCheck: AbilityProbe<Context> = { ...viewer, granted: [['read', 1]] };

// @ts-expect-error a check is an action and a subject, not an action alone
const _shortCheck: AbilityProbe<Context> = { ...viewer, denied: [['edit']] };
