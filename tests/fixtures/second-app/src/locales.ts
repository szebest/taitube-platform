import { createIntl, createIntlCache, defineLocales, type IntlBinding } from '@kit/intl';

export const SHOP_LOCALES = defineLocales({
  source: 'fi-FI',
  details: {
    'fi-FI': { name: 'Suomi', direction: 'ltr', timeZone: 'Europe/Helsinki' },
    'ar-EG': { name: 'العربية', direction: 'rtl', timeZone: 'Africa/Cairo' },
  },
});

export type ShopLocale = (typeof SHOP_LOCALES.tags)[number];

export function shopIntl(locale: ShopLocale): IntlBinding {
  const { timeZone } = SHOP_LOCALES.details[locale];
  return createIntl({ locale, timeZone, cache: createIntlCache() });
}
