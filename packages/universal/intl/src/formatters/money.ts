import { andThen, map } from '@vp/result';
import { type User, resolveCurrency } from '../context';
import { finite } from '../inputs';
import { type OptionKeys, withOptions } from '../with-options';

export const MONEY_OPTION_KEYS = [
  'currency',
  'currencyDisplay',
  'signDisplay',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

export type MoneyOptions = Pick<Intl.NumberFormatOptions, 'currencyDisplay' | 'signDisplay'> & {
  readonly currency?: string | User;
};

/** `minor` counts the currency's smallest unit (pence, öre), so `1250` GBP is £12.50. */
export interface MoneyValue {
  readonly type: 'money';
  readonly value: number;
  readonly units?: 'minor' | 'major';
  readonly options?: MoneyOptions;
}

export const money = withOptions<MoneyValue>('money', MONEY_OPTION_KEYS, (value, context) => {
  const { currency: requested, ...display } = value.options ?? {};
  return andThen(finite('money', value.value), (amount) =>
    andThen(resolveCurrency('money', requested, context), (currency) =>
      map(
        context.cache.numberFormat(context.locale, { ...display, style: 'currency', currency }),
        (format) => {
          const digits = format.resolvedOptions().maximumFractionDigits ?? 0;
          return format.format(value.units === 'minor' ? amount / 10 ** digits : amount);
        }
      )
    )
  );
});
