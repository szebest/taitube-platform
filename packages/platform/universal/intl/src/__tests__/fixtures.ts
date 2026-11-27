import type { FormatContext } from '../context';
import { createIntl } from '../create-intl';
import type { FormatValue } from '../format-value';
import { createIntlCache } from '../intl-cache';

export const NOW = '2026-09-22T18:30:00.000Z';

export const ARABIC_INDIC_DIGIT = /[٠-٩]/;
export const ASCII_DIGIT = /[0-9]/;

export function contextFor(locale: string, overrides: Partial<FormatContext> = {}): FormatContext {
  return { locale, timeZone: 'UTC', now: NOW, cache: createIntlCache(), ...overrides };
}

export function format(value: FormatValue, context: FormatContext) {
  return createIntl(context).format(value);
}

/** The text a value renders as, or the code of the failure that declined it. */
export function formatText(
  value: FormatValue,
  locale = 'en',
  overrides: Partial<FormatContext> = {}
): string {
  const rendered = format(value, contextFor(locale, overrides));
  return rendered.ok ? rendered.value : rendered.error.code;
}
