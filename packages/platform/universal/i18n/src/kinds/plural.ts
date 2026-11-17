import { andThen, err, map } from '@kit/result';
import { unrenderable } from '@vp/intl';
import { type EntryOf, defineKind, isRecord } from '../kind';

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
export const pluralKind = defineKind({
  name: 'plural',
  config: 'required',
  arg: isNumber,
  options: isBranches,
  render: (count, branches, { intl, render }) => {
    if (branches === undefined) return err(unrenderable('plural', 'no branches'));
    return andThen(intl.pluralCategory(count, branches.type), (category) =>
      map(render('number', count, branches.formatter), (digits) =>
        (branches[category] ?? branches.other).replaceAll(COUNT, digits)
      )
    );
  },
});
