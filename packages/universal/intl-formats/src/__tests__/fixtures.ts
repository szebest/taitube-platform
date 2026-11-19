import { type FormatContext, createIntlCache } from '@kit/intl';

export const NOW = '2026-09-22T18:30:00.000Z';

export function contextFor(locale: string): FormatContext {
  return { locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() };
}
