import { LOCALES } from '@vp/shared-messages';
import {
  loadStudioTranslation,
  STUDIO_SOURCE,
} from '../../apps/client/studio/src/lib/messages/catalogue';
import { loadWebTranslation, WEB_SOURCE } from '../../apps/client/web/src/lib/messages/catalogue';

/**
 * A key `en` has and a translation lacks shows English in the middle of the page; a key a
 * translation has and `en` lacks is copy nothing renders, usually a rename that missed a language.
 * Every app's translation holds exactly its source catalogue's key set, the shared words included.
 */
type Catalogue = Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>;

function keysOf(catalogue: Catalogue): Set<string> {
  return new Set(
    Object.entries(catalogue).flatMap(([feature, messages]) =>
      Object.keys(messages ?? {}).map((name) => `${feature}.${name}`)
    )
  );
}

function drift(reference: Catalogue, translation: Catalogue) {
  const expected = keysOf(reference);
  const actual = keysOf(translation);
  return {
    missing: [...expected].filter((key) => !actual.has(key)),
    extra: [...actual].filter((key) => !expected.has(key)),
  };
}

const REFERENCE = { videos: { views: 1, title: 1 }, watch: { share: 1 } };

describe('architecture: every catalogue holds the keys en holds', () => {
  it.each([
    {
      scenario: 'a key en has and the translation lacks',
      translation: { videos: { views: 1 }, watch: { share: 1 } },
      expected: { missing: ['videos.title'], extra: [] },
    },
    {
      scenario: 'a whole feature the translation lacks',
      translation: { videos: { views: 1, title: 1 } },
      expected: { missing: ['watch.share'], extra: [] },
    },
    {
      scenario: 'a key the translation declares and en does not',
      translation: { videos: { views: 1, title: 1, gone: 1 }, watch: { share: 1 } },
      expected: { missing: [], extra: ['videos.gone'] },
    },
  ])('names $scenario', ({ translation, expected }) => {
    expect(drift(REFERENCE, translation)).toEqual(expected);
  });

  const APPS = [
    { app: 'web', source: WEB_SOURCE, load: loadWebTranslation },
    { app: 'studio', source: STUDIO_SOURCE, load: loadStudioTranslation },
  ] as const;

  it.each(
    APPS.flatMap(({ app, source, load }) =>
      LOCALES.tags
        .filter((locale) => locale !== 'en')
        .map((locale) => ({
          app,
          source,
          load,
          locale,
        }))
    )
  )('finds no drift between en and $locale in $app', async ({ source, load, locale }) => {
    expect(drift(source, await load(locale))).toEqual({
      missing: [],
      extra: [],
    });
  });
});
