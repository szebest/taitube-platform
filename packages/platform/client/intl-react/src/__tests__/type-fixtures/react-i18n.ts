import {
  type CatalogueSet,
  type MessageFailure,
  builtInKinds,
  defineEngine,
  defineParams,
} from '@kit/i18n';
import { definePresets } from '@kit/intl';
import type { Result } from '@kit/result';
import { createReactI18n } from '../../react-i18n';

const { dt, createI18n } = defineEngine({
  kinds: builtInKinds,
  presets: definePresets({}),
  params: defineParams(['count'] as const),
});

const source = { videos: { title: dt('Videos') } } as const;
const otherSource = { comments: { title: dt('Comments') } } as const;

const videos = createReactI18n(createI18n<typeof source>());
const comments = createReactI18n(createI18n<typeof otherSource>());

expectTypeOf(videos.useT().t('videos.title')).toEqualTypeOf<Result<string, MessageFailure>>();
expectTypeOf(comments.useT().t('comments.title')).toEqualTypeOf<Result<string, MessageFailure>>();
expectTypeOf(videos.TranslatorProvider)
  .parameter(0)
  .toHaveProperty('catalogues')
  .toEqualTypeOf<CatalogueSet<typeof source>>();

// @ts-expect-error a key of another app's catalogue
videos.useT().t('comments.title');

expectTypeOf(
  videos.TranslatorProvider({
    // @ts-expect-error the catalogues of another app
    catalogues: { locale: 'en', source: otherSource, translations: {} },
    children: null,
  })
).not.toBeAny();

// @ts-expect-error the engine's i18n, not a bare catalogue
createReactI18n(source);
