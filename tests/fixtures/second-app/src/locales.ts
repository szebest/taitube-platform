import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';

export const SHOP_LOCALES = [
  { tag: 'fi-FI', direction: 'ltr', timeZone: 'Europe/Helsinki' },
  { tag: 'ar-EG', direction: 'rtl', timeZone: 'Africa/Cairo' },
] as const;

export type ShopLocale = (typeof SHOP_LOCALES)[number]['tag'];

export function shopIntl(locale: ShopLocale): IntlBinding {
  const { timeZone } = SHOP_LOCALES.find(({ tag }) => tag === locale) ?? SHOP_LOCALES[0];
  return createIntl({ locale, timeZone, cache: createIntlCache() });
}
