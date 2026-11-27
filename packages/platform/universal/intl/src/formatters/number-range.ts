import { type Result, all, andThen, err, map } from '@kit/result';
import { type FormatFailure, unrenderable } from '../failures';
import { finite } from '../inputs';
import { type KindContext, type TaggedOf, defineKind, optionKeys } from '../kind';
import type { NumberInput } from '../number-kind';
import { compact } from './compact';
import { money } from './money';
import { NUMBER_OPTION_KEYS, type NumberOptions, number, numberFormatOptions } from './number';
import { percent } from './percent';

/**
 * One end of a range that is a value of its own kind, `{ type: 'money', value: 5 }`.
 * @public
 */
export interface RangeEnd {
  readonly type: 'number' | 'count' | 'percent' | 'money';
  readonly value: number;
  readonly options?: unknown;
}

type RangeEnds = readonly [number, number] | readonly [RangeEnd, RangeEnd];

const isNumberPair = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((end: unknown) => typeof end === 'number');

const END_TYPES: readonly string[] = ['number', 'count', 'percent', 'money'];

const isRangeEnd = (value: unknown): value is RangeEnd =>
  typeof value === 'object' &&
  value !== null &&
  END_TYPES.includes(String(Reflect.get(value, 'type'))) &&
  typeof Reflect.get(value, 'value') === 'number';

const isRange = (value: unknown): value is RangeEnds =>
  isNumberPair(value) || (Array.isArray(value) && value.length === 2 && value.every(isRangeEnd));

function inputOf(end: RangeEnd, context: KindContext): Result<NumberInput, FormatFailure> {
  switch (end.type) {
    case 'number':
      return number.input(end.value, end.options, context);
    case 'count':
      return compact.input(end.value, end.options, context);
    case 'percent':
      return percent.input(end.value, end.options, context);
    case 'money':
      return money.input(end.value, end.options, context);
  }
}

/**
 * Two numbers as the locale's range (`5-10`), or two values of one kind, so a price range keeps
 * its currency once: `[{ type: 'money', value: 5 }, { type: 'money', value: 10 }]`.
 */
export const numberRange = defineKind({
  name: 'numberRange',
  arg: isRange,
  options: optionKeys<NumberOptions>(NUMBER_OPTION_KEYS),
  render: ([start, end], options, context) => {
    if (typeof start === 'number' && typeof end === 'number') {
      return andThen(all([finite('numberRange', start), finite('numberRange', end)]), () =>
        map(context.cache.numberFormat(context.locale, numberFormatOptions(options)), (format) =>
          format.formatRange(start, end)
        )
      );
    }
    if (typeof start === 'number' || typeof end === 'number') {
      return err(unrenderable('numberRange', 'one end is a bare number, the other a value'));
    }
    if (start.type !== end.type || options !== undefined) {
      return err(
        unrenderable('numberRange', 'the ends are one kind, each carrying its own options')
      );
    }
    return andThen(inputOf(start, context), (from) =>
      andThen(inputOf(end, context), (to) =>
        JSON.stringify(from.format) === JSON.stringify(to.format)
          ? map(context.cache.numberFormat(context.locale, from.format), (format) =>
              format.formatRange(from.amount, to.amount)
            )
          : err(unrenderable('numberRange', 'the ends are formatted differently'))
      )
    );
  },
});

/** @public */
export type NumberRangeValue = TaggedOf<typeof numberRange>;
