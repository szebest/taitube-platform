import { type Result, andThen, err, map, ok } from '@vp/result';
import type { FormatContext } from '../context';
import { type FormatFailure, unrenderable } from '../failures';
import { finite } from '../inputs';

export interface OrdinalValue {
  readonly type: 'ordinal';
  readonly value: number;
}

type Suffixes = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };

/**
 * `Intl.PluralRules` picks the ordinal category but ships no suffixes. These are the written
 * forms per category for each language the product may render; a language missing here declines
 * rather than borrowing English.
 */
const ORDINAL_SUFFIXES: Readonly<Record<string, Suffixes>> = {
  en: { one: 'st', two: 'nd', few: 'rd', other: 'th' },
  sv: { one: ':a', other: ':e' },
  de: { other: '.' },
  fr: { one: 'er', other: 'e' },
  es: { other: '.º' },
  nl: { other: 'e' },
};

function suffixesFor(rules: Intl.PluralRules): Result<Suffixes, FormatFailure> {
  const [language = ''] = rules.resolvedOptions().locale.split('-');
  const suffixes = ORDINAL_SUFFIXES[language];
  return suffixes === undefined
    ? err(unrenderable('ordinal', `no ordinal suffixes for ${language}`))
    : ok(suffixes);
}

export function ordinal(
  value: OrdinalValue,
  context: FormatContext
): Result<string, FormatFailure> {
  const { cache, locale } = context;
  return andThen(finite('ordinal', value.value), (position) =>
    andThen(cache.pluralRules(locale, { type: 'ordinal' }), (rules) =>
      andThen(suffixesFor(rules), (suffixes) =>
        map(cache.numberFormat(locale), (digits) => {
          const suffix = suffixes[rules.select(position)] ?? suffixes.other;
          return `${digits.format(position)}${suffix}`;
        })
      )
    )
  );
}
