import { type Result, err, map } from '@vp/result';
import type { FormatContext } from '../context';
import { type FormatFailure, unrenderable } from '../failures';

const ELLIPSIS = '…';

/**
 * Cuts on grapheme boundaries, so an emoji sequence or a letter with its combining mark is kept
 * whole or dropped whole. The ellipsis counts towards `maxGraphemes`.
 */
export function truncate(
  text: string,
  maxGraphemes: number,
  context: FormatContext
): Result<string, FormatFailure> {
  if (!Number.isInteger(maxGraphemes) || maxGraphemes < 1) {
    return err(unrenderable('truncate', `cannot fit text into ${maxGraphemes} graphemes`));
  }
  return map(context.cache.segmenter(context.locale, { granularity: 'grapheme' }), (segmenter) => {
    const graphemes = Array.from(segmenter.segment(text), ({ segment }) => segment);
    if (graphemes.length <= maxGraphemes) return text;
    return `${graphemes.slice(0, maxGraphemes - 1).join('')}${ELLIPSIS}`;
  });
}
