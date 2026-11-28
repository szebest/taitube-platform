import { andThen, err, ok } from '@kit/result';
import { unrenderable } from '../failures';
import { isString } from '../inputs';
import { type OptionKeys, defineKind, optionKeys } from '../kind';

const DEFAULT_ELLIPSIS = '…';

const TRUNCATE_OPTION_KEYS = [
  'maxGraphemes',
  'ellipsis',
  'position',
  'boundary',
] as const satisfies OptionKeys<TruncateOptions>;

/**
 * `ellipsis` marks the cut and counts towards `maxGraphemes`. `position: 'middle'` keeps both
 * ends (a file name keeps its extension); `boundary: 'word'` never cuts inside a word.
 */
export interface TruncateOptions {
  readonly maxGraphemes: number;
  readonly ellipsis?: string;
  readonly position?: 'end' | 'middle';
  readonly boundary?: 'grapheme' | 'word';
}

interface Unit {
  readonly text: string;
  readonly size: number;
}

function within(units: readonly Unit[], budget: number): string[] {
  let used = 0;
  const kept: string[] = [];
  for (const unit of units) {
    if (used + unit.size > budget) break;
    used += unit.size;
    kept.push(unit.text);
  }
  return kept;
}

/**
 * Cuts on grapheme boundaries, so an emoji sequence or a letter with its combining mark is kept
 * whole or dropped whole.
 */
export const truncate = defineKind({
  name: 'truncate',
  arg: isString,
  options: optionKeys<TruncateOptions>(TRUNCATE_OPTION_KEYS),
  render: (text, options, context) => {
    const {
      maxGraphemes,
      ellipsis = DEFAULT_ELLIPSIS,
      position = 'end',
      boundary = 'grapheme',
    } = options ?? {};
    return andThen(
      context.cache.segmenter(context.locale, { granularity: 'grapheme' }),
      (letters) =>
        andThen(context.cache.segmenter(context.locale, { granularity: boundary }), (segmenter) => {
          const count = (value: string) => Array.from(letters.segment(value)).length;
          if (
            maxGraphemes === undefined ||
            !Number.isInteger(maxGraphemes) ||
            maxGraphemes < count(ellipsis)
          ) {
            return err(unrenderable('truncate', `cannot fit text into ${maxGraphemes} graphemes`));
          }
          if (count(text) <= maxGraphemes) return ok(text);

          const budget = maxGraphemes - count(ellipsis);
          const units = Array.from(segmenter.segment(text), ({ segment }) => ({
            text: segment,
            size: count(segment),
          }));
          const tidy = (value: string) => (boundary === 'word' ? value.trimEnd() : value);
          if (position === 'end') {
            return ok(`${tidy(within(units, budget).join(''))}${ellipsis}`);
          }
          const head = tidy(within(units, Math.ceil(budget / 2)).join(''));
          const tail = within([...units].reverse(), Math.floor(budget / 2))
            .reverse()
            .join('');
          return ok(`${head}${ellipsis}${boundary === 'word' ? tail.trimStart() : tail}`);
        })
    );
  },
});
