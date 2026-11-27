import { createAbilityFactory, type RuleSet } from '../ability-factory';
import { describeAbilityFactoryContract } from '../contract';

type Action = 'read' | 'edit';
type Subject = 'Video' | 'Comment';
interface Context {
  readonly role: 'viewer' | 'editor';
}

const rules: RuleSet<Action, Subject, Context> = ({ role }, { can }) => {
  can('read', 'Video');
  if (role === 'editor') can('edit', 'Video');
};

describeAbilityFactoryContract(
  () => createAbilityFactory([rules]),
  [
    {
      context: { role: 'viewer' },
      granted: [['read', 'Video']],
      denied: [
        ['edit', 'Video'],
        ['read', 'Comment'],
      ],
    },
    {
      context: { role: 'editor' },
      granted: [
        ['read', 'Video'],
        ['edit', 'Video'],
      ],
      denied: [['edit', 'Comment']],
    },
  ]
);
