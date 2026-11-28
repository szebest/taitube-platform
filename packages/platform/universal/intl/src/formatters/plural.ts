import { andThen, map } from '@kit/result';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, defineKind, optionKeys } from '../kind';

const PLURAL_OPTION_KEYS = ['type'] as const satisfies OptionKeys<Intl.PluralRulesOptions>;

type PluralOptions = Pick<Intl.PluralRulesOptions, (typeof PLURAL_OPTION_KEYS)[number]>;

/** Selects which catalogue branch a count takes; the words themselves belong to the catalogue. */
export const pluralCategory = defineKind({
  name: 'pluralCategory',
  arg: isNumber,
  options: optionKeys<PluralOptions>(PLURAL_OPTION_KEYS),
  render: (count, options, context) =>
    andThen(finite('plural', count), (finiteCount) =>
      map(
        context.cache.pluralRules(context.locale, { type: options?.type ?? 'cardinal' }),
        (rules) => rules.select(finiteCount)
      )
    ),
});
