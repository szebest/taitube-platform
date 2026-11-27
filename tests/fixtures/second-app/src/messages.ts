import { builtInKinds, defineEngine, defineParams } from '@kit/i18n';
import { definePresets } from '@kit/intl';

export const SHOP_PRESETS = definePresets({
  number: {
    tally: { default: { useGrouping: false }, 'ar-EG': { useGrouping: true } },
  },
});

const { dt, defineCatalogue, createI18n } = defineEngine({
  kinds: builtInKinds,
  presets: SHOP_PRESETS,
  params: defineParams(['copies', 'title'] as const),
});

export const fi = {
  shelf: {
    stock: dt('{copies:plural}', {
      plural: { copies: { one: '{?} kappale', other: '{?} kappaletta', formatter: 'tally' } },
    }),
    heading: dt('Kirjahylly: {title}'),
  },
};

export const ar = defineCatalogue<typeof fi>()({
  shelf: {
    heading: dt('رف الكتب: {title}'),
  },
});

export const shopI18n = createI18n<typeof fi>();
export const SHOP_CATALOGUES = { locale: 'fi-FI', source: fi, translations: { 'ar-EG': ar } };
