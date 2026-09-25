import { type Result, andThen, map } from '@vp/result';
import type { FormatContext } from '../context';
import type { FormatFailure } from '../failures';
import { finite } from '../inputs';

/** Selects which catalogue branch a count takes; the words themselves belong to the catalogue. */
export function pluralCategory(
  count: number,
  context: FormatContext,
  type: Intl.PluralRuleType = 'cardinal'
): Result<Intl.LDMLPluralRule, FormatFailure> {
  return andThen(finite('plural', count), (finiteCount) =>
    map(context.cache.pluralRules(context.locale, { type }), (rules) => rules.select(finiteCount))
  );
}
