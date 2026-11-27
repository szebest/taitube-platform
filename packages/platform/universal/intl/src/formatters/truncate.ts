import { err, map } from '@kit/result';
import { unrenderable } from '../failures';
import { isString } from '../inputs';
import { type OptionKeys, defineKind, optionKeys } from '../kind';

const ELLIPSIS = '…';

const TRUNCATE_OPTION_KEYS = ['maxGraphemes'] as const satisfies OptionKeys<TruncateOptions>;

export interface TruncateOptions {
  readonly maxGraphemes: number;
}

/**
 * Cuts on grapheme boundaries, so an emoji sequence or a letter with its combining mark is kept
 * whole or dropped whole. The ellipsis counts towards `maxGraphemes`.
 */
export const truncate = defineKind({
  name: 'truncate',
  arg: isString,
  options: optionKeys<TruncateOptions>(TRUNCATE_OPTION_KEYS),
  render: (text, options, context) => {
    const maxGraphemes = options?.maxGraphemes;
    if (maxGraphemes === undefined || !Number.isInteger(maxGraphemes) || maxGraphemes < 1) {
      return err(unrenderable('truncate', `cannot fit text into ${maxGraphemes} graphemes`));
    }
    return map(
      context.cache.segmenter(context.locale, { granularity: 'grapheme' }),
      (segmenter) => {
        const graphemes = Array.from(segmenter.segment(text), ({ segment }) => segment);
        if (graphemes.length <= maxGraphemes) return text;
        return `${graphemes.slice(0, maxGraphemes - 1).join('')}${ELLIPSIS}`;
      }
    );
  },
});
