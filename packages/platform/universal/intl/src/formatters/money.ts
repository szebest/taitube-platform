import { andThen, map } from '@kit/result';
import { type User, resolveCurrency } from '../context';
import { finite, isNumber } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

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

export const money = defineKind({
  name: 'money',
  arg: isNumber,
  options: optionKeys<MoneyOptions>(MONEY_OPTION_KEYS),
  render: (value, options, context) => {
    const { currency: requested, units = 'major', ...display } = options ?? {};
    return andThen(finite('money', value), (amount) =>
      andThen(resolveCurrency('money', requested, context), (currency) =>
        map(
          context.cache.numberFormat(context.locale, { ...display, style: 'currency', currency }),
          (format) => {
            const digits = format.resolvedOptions().maximumFractionDigits ?? 0;
            return format.format(units === 'minor' ? amount / 10 ** digits : amount);
          }
        )
      )
    );
  },
});

/** @public */
export type MoneyValue = TaggedOf<typeof money>;
