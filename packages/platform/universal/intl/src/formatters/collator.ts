import { map } from '@kit/result';
import { type OptionKeys, defineKind, optionKeys } from '../kind';

const COLLATOR_OPTION_KEYS = [
  'sensitivity',
  'numeric',
  'caseFirst',
  'ignorePunctuation',
  'usage',
] as const satisfies OptionKeys<Intl.CollatorOptions>;

export type CollatorOptions = Pick<Intl.CollatorOptions, (typeof COLLATOR_OPTION_KEYS)[number]>;

export type Comparator = (a: string, b: string) => number;

/** A comparator for `.sort()` in the locale's alphabetical order, where `Ä` is not after `Z`. */
export const collator = defineKind({
  name: 'collator',
  arg: (value): value is undefined => value === undefined,
  options: optionKeys<CollatorOptions>(COLLATOR_OPTION_KEYS),
  render: (_, options, context) =>
    map(context.cache.collator(context.locale, options), (format): Comparator => format.compare),
});
