import { type ForcedSubject, type MongoAbility, subject } from '@casl/ability';
import { type RuleSet, createAbilityFactory } from '../ability-factory';

type Action = 'read' | 'write';
type Subjects = 'Note' | ({ authorId: string } & ForcedSubject<'Note'>);
interface Reader {
  readonly id: string;
  readonly editor: boolean;
}

const readNotes: RuleSet<Action, Subjects, Reader> = (_reader, { can }) => {
  can('read', 'Note');
};
const writeOwnNotes: RuleSet<Action, Subjects, Reader> = (reader, { can }) => {
  can('write', 'Note', { authorId: reader.id });
};
const editorsWriteAll: RuleSet<Action, Subjects, Reader> = (reader, { can }) => {
  if (reader.editor) can('write', 'Note');
};
const nobodyWrites: RuleSet<Action, Subjects, Reader> = (_reader, { cannot }) => {
  cannot('write', 'Note');
};

const author: Reader = { id: 'u-1', editor: false };
const editor: Reader = { id: 'u-2', editor: true };
const ownNote = subject('Note', { authorId: 'u-1' });

describe('createAbilityFactory', () => {
  it.each([
    {
      scenario: 'no rule set grants nothing',
      ruleSets: [],
      reader: author,
      action: 'read',
      allowed: false,
    },
    {
      scenario: 'a granting rule set',
      ruleSets: [readNotes],
      reader: author,
      action: 'read',
      allowed: true,
    },
    {
      scenario: 'a condition on the context',
      ruleSets: [writeOwnNotes],
      reader: author,
      action: 'write',
      allowed: true,
    },
    {
      scenario: 'a condition another caller misses',
      ruleSets: [writeOwnNotes],
      reader: editor,
      action: 'write',
      allowed: false,
    },
    {
      scenario: 'a branch on the context',
      ruleSets: [editorsWriteAll],
      reader: editor,
      action: 'write',
      allowed: true,
    },
    {
      scenario: 'a later cannot over an earlier can',
      ruleSets: [writeOwnNotes, nobodyWrites],
      reader: author,
      action: 'write',
      allowed: false,
    },
    {
      scenario: 'a later can over an earlier cannot',
      ruleSets: [nobodyWrites, writeOwnNotes],
      reader: author,
      action: 'write',
      allowed: true,
    },
  ] satisfies {
    scenario: string;
    ruleSets: RuleSet<Action, Subjects, Reader>[];
    reader: Reader;
    action: Action;
    allowed: boolean;
  }[])('answers $scenario', ({ ruleSets, reader, action, allowed }) => {
    const abilityFor = createAbilityFactory(ruleSets);

    expect(abilityFor(reader).can(action, ownNote)).toBe(allowed);
  });

  it('builds a fresh ability per context', () => {
    const abilityFor = createAbilityFactory([writeOwnNotes]);

    expect(abilityFor(author)).not.toBe(abilityFor(author));
  });

  it('carries the action and subject unions into the ability', () => {
    const abilityFor = createAbilityFactory([readNotes]);

    expectTypeOf(abilityFor(author)).toEqualTypeOf<MongoAbility<[Action, Subjects]>>();
    // @ts-expect-error an action outside the union
    abilityFor(author).can('delete', 'Note');
    // @ts-expect-error a context of another shape
    abilityFor({ id: 'u-3' });
  });
});
