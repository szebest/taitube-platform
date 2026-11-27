import { all, andThen, map } from '@kit/result';
import { finite } from '../inputs';
import { type TaggedOf, defineKind, optionKeys } from '../kind';
import { NUMBER_OPTION_KEYS, type NumberOptions, numberFormatOptions } from './number';

const isNumberPair = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((end: unknown) => typeof end === 'number');

export const numberRange = defineKind({
  name: 'numberRange',
  arg: isNumberPair,
  options: optionKeys<NumberOptions>(NUMBER_OPTION_KEYS),
  render: ([start, end], options, context) =>
    andThen(all([finite('numberRange', start), finite('numberRange', end)]), () =>
      map(context.cache.numberFormat(context.locale, numberFormatOptions(options)), (format) =>
        format.formatRange(start, end)
      )
    ),
});

/** @public */
export type NumberRangeValue = TaggedOf<typeof numberRange>;
