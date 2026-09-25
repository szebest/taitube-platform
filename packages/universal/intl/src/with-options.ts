import { type Result, err } from '@vp/result';
import type { FormatContext } from './context';
import { type FormatFailure, unknownOption } from './failures';

/** A formatter's allowed option names: the `Intl` constructor's own keys, plus any it adds. */
export type OptionKeys<Native, Ours extends string = never> = readonly (keyof Native | Ours)[];

export type Formatter<V> = (value: V, context: FormatContext) => Result<string, FormatFailure>;

export function findUnknownOption(
  allowed: readonly PropertyKey[],
  options: object | undefined
): string | undefined {
  return Object.keys(options ?? {}).find((key) => !allowed.includes(key));
}

/**
 * Declines an option the formatter does not name instead of letting `Intl` ignore it, so
 * `date(stlye: 'short')` fails with the misspelling rather than rendering a default.
 */
export function withOptions<V extends { readonly options?: object }>(
  formatter: string,
  allowed: readonly (keyof NonNullable<V['options']>)[],
  format: Formatter<V>
): Formatter<V> {
  return (value, context) => {
    const unknown = findUnknownOption(allowed, value.options);
    return unknown === undefined ? format(value, context) : err(unknownOption(formatter, unknown));
  };
}
