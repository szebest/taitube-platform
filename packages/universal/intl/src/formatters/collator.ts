import { type Result, err, map } from '@vp/result';
import type { FormatContext } from '../context';
import { type FormatFailure, unknownOption } from '../failures';
import { type OptionKeys, findUnknownOption } from '../with-options';

const COLLATOR_OPTION_KEYS = [
  'sensitivity',
  'numeric',
  'caseFirst',
  'ignorePunctuation',
] as const satisfies OptionKeys<Intl.CollatorOptions>;

export type CollatorOptions = Pick<Intl.CollatorOptions, (typeof COLLATOR_OPTION_KEYS)[number]>;

export type Comparator = (a: string, b: string) => number;

/** A comparator for `.sort()` in the locale's alphabetical order, where `Ä` is not after `Z`. */
export function collator(
  context: FormatContext,
  options: CollatorOptions = {}
): Result<Comparator, FormatFailure> {
  const unknown = findUnknownOption(COLLATOR_OPTION_KEYS, options);
  if (unknown !== undefined) return err(unknownOption('collator', unknown));
  return map(context.cache.collator(context.locale, options), (format) => format.compare);
}
