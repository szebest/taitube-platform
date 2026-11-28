import { type Result, map } from '@kit/result';
import type { FormatContext } from './context';
import type { FormatFailure } from './failures';

export interface SplitText {
  readonly first: string;
  readonly rest: string;
}

/**
 * The first user-perceived character of `text`, upper-cased by the viewer's language (`i` is `İ`
 * in `tr`), and what follows it. A UTF-16 `charAt(0)` cuts an emoji sequence in half.
 */
export function upperFirstGrapheme(
  text: string,
  context: FormatContext
): Result<SplitText, FormatFailure> {
  return map(context.cache.segmenter(context.locale, { granularity: 'grapheme' }), (letters) => {
    const first = letters.segment(text)[Symbol.iterator]().next().value?.segment ?? '';
    return { first: first.toLocaleUpperCase(context.locale), rest: text.slice(first.length) };
  });
}
