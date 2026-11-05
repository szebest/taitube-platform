import { en, LOCALE_DETAILS, SUPPORTED_LOCALES } from '@vp/messages';

/**
 * A key `en` has and a translation lacks shows English in the middle of the page; a key a
 * translation has and `en` lacks is copy nothing renders, usually a rename that missed a language.
 * Every catalogue holds exactly `en`'s key set.
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

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'en'))(
    'finds no drift between en and %s',
    async (locale) => {
      const translation = await LOCALE_DETAILS[locale].load();

      expect(drift(en, translation)).toEqual({ missing: [], extra: [] });
    }
  );
});
