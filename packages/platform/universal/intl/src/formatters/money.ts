import { andThen, map } from '@kit/result';
import { type User, resolveCurrency } from '../context';
import { type OptionKeys, type TaggedOf } from '../kind';
import { defineNumberKind } from '../number-kind';

const MONEY_OPTION_KEYS = [
  'currency',
  'currencyDisplay',
  'signDisplay',
  'units',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'units'>;

/** `minor` counts the currency's smallest unit (pence, öre), so `1250` GBP is £12.50. */
type MoneyOptions = Pick<Intl.NumberFormatOptions, 'currencyDisplay' | 'signDisplay'> & {
  readonly currency?: string | User;
  readonly units?: 'minor' | 'major';
};

export const money = defineNumberKind({
  name: 'money',
  keys: MONEY_OPTION_KEYS,
  transform: (value, options: Partial<MoneyOptions>, context) => {
    const { currency: requested, units = 'major', ...display } = options;
    return andThen(resolveCurrency('money', requested, context), (currency) => {
      const format = { ...display, style: 'currency', currency } as const;
      return map(context.cache.numberFormat(context.locale, format), (formatter) => {
        const digits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
        return { amount: units === 'minor' ? value / 10 ** digits : value, format };
      });
    });
  },
});

/** @public */
export type MoneyValue = TaggedOf<typeof money>;
