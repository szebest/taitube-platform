import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import { defineEngine } from '../engine';
import { builtInKinds } from '../kinds';
import { defineParams } from '../params';
import { definePresets } from '../presets';

export const NOW = '2026-09-22T18:30:00.000Z';

export function intlFor(locale: string): IntlBinding {
  return createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });
}

export const params = defineParams(['count', 'name', 'names', 'when', 'state', 'price'] as const);

export const presets = definePresets({
  number: {
    compact: {
      default: { notation: 'compact' },
      pl: { notation: 'compact', maximumFractionDigits: 0 },
    },
    whole: { default: { maximumFractionDigits: 0 } },
  },
});

export const engine = defineEngine({ kinds: builtInKinds, presets, params });

const { dt } = engine;

export const source = {
  videos: {
    views: dt('{count:plural}', {
      plural: { count: { one: '{?} view', other: '{?} views', formatter: 'compact' } },
    }),
    categories: dt('In {names:list}'),
    state: dt('{state:enum}', { enum: { state: { ready: 'Ready', failed: 'Failed' } } }),
  },
  errors: { forbidden: dt('Not allowed.') },
};

export const swedish = engine.defineCatalogue<typeof source>()({
  videos: {
    views: dt('{count:plural}', {
      plural: { count: { one: '{?} visning', other: '{?} visningar' } },
    }),
  },
});

export const i18n = engine.createI18n<typeof source>();

export const catalogues = { locale: 'en', source, translations: { sv: swedish } };
