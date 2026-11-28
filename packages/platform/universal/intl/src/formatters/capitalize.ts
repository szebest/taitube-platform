import { map } from '@kit/result';
import { upperFirstGrapheme } from '../first-grapheme';
import { isString } from '../inputs';
import { type TaggedOf, defineKind, optionKeys } from '../kind';

/** `xlarge` is `Xlarge`; only the first character changes, upper-cased by the viewer's language. */
export const capitalize = defineKind({
  name: 'capitalize',
  arg: isString,
  options: optionKeys<Record<string, never>>([]),
  render: (text, _, context) =>
    map(upperFirstGrapheme(text, context), ({ first, rest }) => `${first}${rest}`),
});

/** @public */
export type CapitalizeValue = TaggedOf<typeof capitalize>;
