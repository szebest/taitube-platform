import { defineKind, pluralCategory, runKind, unrenderable } from '@kit/intl';
import { andThen, err, map, ok } from '@kit/result';
import { type EntryOf, isRecord, messageKind } from '../kind';

const COUNT = '{?}';

/** The branches a count selects between: `other` always, any CLDR category besides; `{?}` is the count. */
export type Branches = { readonly [Category in Intl.LDMLPluralRule]?: string } & {
  readonly other: string;
  readonly formatter?: EntryOf<'number'>;
  readonly type?: Intl.PluralRuleType;
};

const isNumber = (value: unknown): value is number => typeof value === 'number';

const isBranches = (value: unknown): value is Branches =>
  isRecord(value) && typeof value.other === 'string';

/** `{count:plural}`: a number that selects a branch through `Intl.PluralRules`; the count renders as a `number`. */
export const pluralKind = messageKind(
  defineKind({
    name: 'plural',
    arg: isNumber,
    options: (value, kind) =>
      isBranches(value) ? ok(value) : err(unrenderable(kind, 'branches without other')),
    render: (count, branches, context) => {
      if (branches === undefined) return err(unrenderable('plural', 'no branches'));
      const rules = runKind(pluralCategory, count, { type: branches.type }, context);
      return andThen(rules, (category) =>
        map(
          context.format({ type: 'number', value: count, options: branches.formatter }),
          (digits) => (branches[category] ?? branches.other).replaceAll(COUNT, digits)
        )
      );
    },
  }),
  'required'
);
