# @kit/permissions

A CASL ability built from the app's rule sets, and a guard that throws `UNAUTHORIZED` or `FORBIDDEN`.

Install: `pnpm add @kit/permissions @casl/ability`. It depends on `@kit/errors`; `@casl/ability` is a peer.

Tokens: none. Registries: none. The app passes its rule sets to `createAbilityFactory`.

```ts
import type { ForcedSubject } from '@casl/ability';
import { type RuleSet, assertCan, createAbilityFactory } from '@kit/permissions';

type Action = 'read' | 'write';
type Subjects = 'Note' | ({ authorId: string } & ForcedSubject<'Note'>);
type Caller = { id: string; role: string } | null;

const readNotes: RuleSet<Action, Subjects, Caller> = (_caller, { can }) => can('read', 'Note');
const writeOwnNotes: RuleSet<Action, Subjects, Caller> = (caller, { can }) => {
  if (caller) can('write', 'Note', { authorId: caller.id });
};

const abilityFor = createAbilityFactory([readNotes, writeOwnNotes]);

const caller = { id: 'u-1', role: 'member' };
assertCan(abilityFor(caller).can('write', 'Note'), { action: 'write', subject: 'Note', user: caller });
```

Rule sets apply in order and a later rule wins, so a rule set that overrides the others goes last.
`assertCan` throws `UNAUTHORIZED` and `FORBIDDEN` from `@kit/errors`' `CommonErrorCodes`, which the app's
error code set already spreads in.
