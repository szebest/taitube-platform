import type { Result } from '@vp/result';
import type { FormatContext } from './context';
import type { FormatFailure } from './failures';
import { type FormatValue, formatValue } from './format-value';
import { type CollatorOptions, type Comparator, collator } from './formatters/collator';
import { pluralCategory } from './formatters/plural';
import { truncate } from './formatters/truncate';

/** Every formatter bound to one context: what a provider hands its components. */
export interface IntlBinding {
  readonly context: FormatContext;
  format(value: FormatValue): Result<string, FormatFailure>;
  pluralCategory(
    count: number,
    type?: Intl.PluralRuleType
  ): Result<Intl.LDMLPluralRule, FormatFailure>;
  collator(options?: CollatorOptions): Result<Comparator, FormatFailure>;
  truncate(text: string, maxGraphemes: number): Result<string, FormatFailure>;
}

export function createIntl(context: FormatContext): IntlBinding {
  return {
    context,
    format: (value) => formatValue(value, context),
    pluralCategory: (count, type) => pluralCategory(count, context, type),
    collator: (options) => collator(context, options),
    truncate: (text, maxGraphemes) => truncate(text, maxGraphemes, context),
  };
}
