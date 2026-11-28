import { type Result, andThen, err, map, ok } from '@kit/result';
import { resolveCurrency } from '../context';
import { type FormatFailure, unrenderable } from '../failures';
import { type OptionKeys, type TaggedOf } from '../kind';
import { type NumberInput, defineNumberKind } from '../number-kind';

const MONEY_OPTION_KEYS = [
  'currency',
  'currencyDisplay',
  'currencySign',
  'notation',
  'signDisplay',
  'trailingZeroDisplay',
  'units',
] as const satisfies OptionKeys<Intl.NumberFormatOptions, 'units'>;

/** `minor` counts the currency's smallest unit (pence, öre), so `1250` GBP is £12.50. */
type MoneyOptions = Pick<
  Intl.NumberFormatOptions,
  'currencyDisplay' | 'currencySign' | 'notation' | 'signDisplay' | 'trailingZeroDisplay'
> & {
  readonly currency?: string;
  readonly units?: 'minor' | 'major';
};

const isDecimal = (text: string): text is Intl.StringNumericLiteral => /^-?\d+(\.\d+)?$/.test(text);

/** `1250` minor units at 2 digits as the exact decimal `12.50`, never a float division. */
function shiftDecimal(
  minor: number,
  digits: number
): Result<Intl.StringNumericLiteral, FormatFailure> {
  if (!Number.isSafeInteger(minor)) {
    return err(unrenderable('money', `${minor} is not a whole number of minor units`));
  }
  const padded = Math.abs(minor)
    .toString()
    .padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  const text = `${minor < 0 ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
  return isDecimal(text) ? ok(text) : err(unrenderable('money', `${minor} has no decimal form`));
}

export const money = defineNumberKind({
  name: 'money',
  keys: MONEY_OPTION_KEYS,
  transform: (
    value,
    options: Partial<MoneyOptions>,
    context
  ): Result<NumberInput, FormatFailure> => {
    const { currency: requested, units = 'major', ...display } = options;
    return andThen(
      resolveCurrency('money', requested, context),
      (currency): Result<NumberInput, FormatFailure> => {
        const format = { ...display, style: 'currency', currency } as const;
        if (units === 'major') return ok({ amount: value, format });
        return andThen(
          context.cache.numberFormat(context.locale, { style: 'currency', currency }),
          (plain) =>
            map(
              shiftDecimal(value, plain.resolvedOptions().maximumFractionDigits ?? 0),
              (amount) => ({
                amount,
                format,
              })
            )
        );
      }
    );
  },
});

/** @public */
export type MoneyValue = TaggedOf<typeof money>;
