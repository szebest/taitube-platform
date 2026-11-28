import { type Result, andThen, err, ok } from '@kit/result';
import type { FormatContext } from '../context';
import { type FormatFailure, unrenderable } from '../failures';

const BIDI_MARKS = /[‎‏؜]/g;
const WHITESPACE = /\s/;
const MINUS_SIGNS: ReadonlySet<string> = new Set(['-', '−']);
const ONLY_DIGITS = /^\d*$/;
const DIGITS = 10;

interface Symbols {
  readonly group: string;
  readonly decimal: string;
  readonly minus: string;
  readonly digitOf: ReadonlyMap<string, string>;
  readonly grouped: Intl.NumberFormat;
}

function symbolsOf(context: FormatContext): Result<Symbols, FormatFailure> {
  const { cache, locale } = context;
  return andThen(cache.numberFormat(locale, { useGrouping: 'always' }), (grouped) =>
    andThen(cache.numberFormat(locale, { useGrouping: false }), (plain) => {
      const parts = grouped.formatToParts(-1234567.5);
      const symbol = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
      const digitOf = new Map(
        Array.from({ length: DIGITS }, (_, digit): [string, string] => [
          plain.format(digit),
          String(digit),
        ])
      );
      return ok({
        group: symbol('group'),
        decimal: symbol('decimal'),
        minus: symbol('minusSign').replace(BIDI_MARKS, ''),
        digitOf,
        grouped,
      });
    })
  );
}

function canonical(text: string, { digitOf }: Symbols): string {
  return Array.from(text, (char) =>
    WHITESPACE.test(char) ? ' ' : (digitOf.get(char) ?? char)
  ).join('');
}

/**
 * The number a person typed, read by the viewer's locale: its grouping and decimal symbols and
 * its numerals (`1 234,5` in `pl` and `1,234.5` in `en` are both `1234.5`). Grouping, when
 * typed, must be the locale's own, so `12,3,4` is declined instead of read as `1234`.
 * @public
 */
export function parseDecimal(text: string, context: FormatContext): Result<number, FormatFailure> {
  const decline = (reason: string) => err(unrenderable('parseDecimal', `${text}: ${reason}`));
  return andThen(symbolsOf(context), (symbols) => {
    const signs = new Set([...MINUS_SIGNS, symbols.minus]);
    const typed = text.replace(BIDI_MARKS, '').trim();
    const negative = signs.has(typed.charAt(0));
    const unsigned = negative ? typed.slice(1) : typed;
    const decimalAt = unsigned.indexOf(symbols.decimal);
    const integerText = decimalAt < 0 ? unsigned : unsigned.slice(0, decimalAt);
    const fractionText = decimalAt < 0 ? '' : unsigned.slice(decimalAt + symbols.decimal.length);
    const group = canonical(symbols.group, symbols);
    const integer = canonical(integerText, symbols);
    const fraction = canonical(fractionText, symbols);
    const digits = integer.replaceAll(group, '');

    if (!ONLY_DIGITS.test(digits) || !ONLY_DIGITS.test(fraction)) return decline('not a number');
    if (digits === '' && fraction === '') return decline('no digits');
    if (integer.includes(group)) {
      const expected = canonical(symbols.grouped.format(BigInt(digits)), symbols);
      if (expected !== integer) return decline("the grouping is not the locale's");
    }
    return ok(Number(`${negative ? '-' : ''}${digits || '0'}.${fraction || '0'}`));
  });
}
