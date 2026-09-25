import { all, andThen, map } from '@vp/result';
import { finite } from '../inputs';
import { withOptions } from '../with-options';
import { NUMBER_OPTION_KEYS, type NumberOptions, numberFormatOptions } from './number';

export interface NumberRangeValue {
  readonly type: 'numberRange';
  readonly value: readonly [number, number];
  readonly options?: NumberOptions;
}

export const numberRange = withOptions<NumberRangeValue>(
  'numberRange',
  NUMBER_OPTION_KEYS,
  (value, context) => {
    const [start, end] = value.value;
    return andThen(all([finite('numberRange', start), finite('numberRange', end)]), () =>
      map(
        context.cache.numberFormat(context.locale, numberFormatOptions(value.options)),
        (format) => format.formatRange(start, end)
      )
    );
  }
);
