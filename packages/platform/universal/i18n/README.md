# @kit/i18n

A typed message engine: templates whose placeholders type their arguments, configs checked against the template,
catalogues whose translations keep the source's params, and a `t` typed by the catalogue the app registers. It holds
no words and no locale data; the app brings both.

```ts
import { builtInKinds, defineEngine, defineParams } from '@kit/i18n';
import { definePresets } from '@kit/intl';

export const engine = defineEngine({
  kinds: builtInKinds,
  presets: definePresets({ number: { compact: { default: { notation: 'compact' } } } }),
  params: defineParams(['count', 'name'] as const),
});
const { dt, defineCatalogue, createI18n } = engine;

export const en = {
  videos: {
    views: dt('{count:plural}', {
      plural: { count: { one: '{?} view', other: '{?} views', formatter: 'compact' } },
    }),
  },
};
export const sv = defineCatalogue<typeof en>()({
  videos: { views: dt('{count:plural}', { plural: { count: { one: '{?} visning', other: '{?} visningar' } } }) },
});

const i18n = createI18n<typeof en>();
const { t } = i18n.createTranslator(intl, { locale: 'en', source: en, translations: { sv } });
t('videos.views', { count: 3 }); // Result<string, MessageFailure>
```

A new kind is `defineKind({ name, config, arg, options, render })` in the app, listed in `kinds`; the engine is not
edited. At the composition root, `i18n.providers(catalogues)` provides `Catalogues`, `FormatPresets` and
`ParamVocabulary`, and `i18n.fromRegistry(registry, intl)` reads them back.
