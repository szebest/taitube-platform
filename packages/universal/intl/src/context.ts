import { type Result, err, ok } from '@vp/result';
import { type FormatFailure, unrenderable } from './failures';
import type { IntlCache } from './intl-cache';

/** Stands for the viewer's own locale or currency, resolved against the context at format time. */
export const USER = 'user';
export type User = typeof USER;

/**
 * Everything a formatter may know about where and when it renders. The locale, the zone and the
 * reference instant are arguments, never read from the runtime, so a server render and a browser
 * hydration given the same context produce the same bytes.
 */
export interface FormatContext {
  readonly locale: string;
  readonly timeZone: string;
  readonly currency?: string;
  readonly now?: string;
  readonly cache: IntlCache;
}

export function resolveCurrency(
  formatter: string,
  requested: string | User | undefined,
  context: FormatContext
): Result<string, FormatFailure> {
  const currency = requested === undefined || requested === USER ? context.currency : requested;
  if (currency === undefined) {
    return err(unrenderable(formatter, 'no currency given or configured'));
  }
  return context.cache.currencies().has(currency.toUpperCase())
    ? ok(currency)
    : err(unrenderable(formatter, `unknown currency ${currency}`));
}
