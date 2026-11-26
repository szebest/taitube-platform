import { LOCALES } from '@vp/shared-messages';
import {
  loadStudioTranslation,
  STUDIO_SOURCE,
} from '../../apps/client/studio/src/lib/messages/catalogue';
import { loadWebTranslation, WEB_SOURCE } from '../../apps/client/web/src/lib/messages/catalogue';

/**
 * A plural holds exactly the categories its locale can select, and `other`: a missing one renders
 * the `other` branch where the language needs another form, and one the locale never selects is
 * copy nothing renders. `Intl.PluralRules` is the authority, per locale and per rule type.
 */
type Catalogue = Readonly<
  Record<string, Readonly<Record<string, { readonly config: object } | undefined>> | undefined>
>;

interface Mismatch {
  readonly key: string;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
}

const NOT_BRANCHES = new Set(['formatter', 'type']);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function pluralMismatches(locale: string, catalogue: Catalogue): Mismatch[] {
  return Object.entries(catalogue).flatMap(([namespace, messages]) =>
    Object.entries(messages ?? {}).flatMap(([name, message]) => {
      const plurals = isRecord(message?.config) ? message.config['plural'] : undefined;
      return Object.values(isRecord(plurals) ? plurals : {}).flatMap((branches) => {
        if (!isRecord(branches)) return [];
        const type = branches['type'] === 'ordinal' ? 'ordinal' : 'cardinal';
        const expected = new Set<string>([
          ...new Intl.PluralRules(locale, { type }).resolvedOptions().pluralCategories,
          'other',
        ]);
        const actual = Object.keys(branches).filter((key) => !NOT_BRANCHES.has(key));
        const missing = [...expected].filter((category) => !actual.includes(category)).sort();
        const extra = actual.filter((category) => !expected.has(category)).sort();
        return missing.length + extra.length === 0
          ? []
          : [{ key: `${namespace}.${name}`, missing, extra }];
      });
    })
  );
}

const APPS = [
  { app: 'web', source: WEB_SOURCE, load: loadWebTranslation },
  { app: 'studio', source: STUDIO_SOURCE, load: loadStudioTranslation },
] as const;

describe('architecture: every plural holds exactly its locale categories', () => {
  it.each([
    {
      scenario: 'a pl plural with only one and other',
      branches: { one: '{?} plik', other: '{?} pliku' },
      expected: [{ key: 'files.count', missing: ['few', 'many'], extra: [] }],
    },
    {
      scenario: 'a pl plural with a category pl never selects',
      branches: { zero: 'brak', one: '1', few: '2', many: '5', other: '1,5' },
      expected: [{ key: 'files.count', missing: [], extra: ['zero'] }],
    },
  ])('names $scenario', ({ branches, expected }) => {
    const planted = { files: { count: { config: { plural: { count: branches } } } } };

    expect(pluralMismatches('pl', planted)).toEqual(expected);
  });

  it('reads an ordinal against the ordinal rules', () => {
    const planted = {
      videos: { rank: { config: { plural: { n: { type: 'ordinal', other: '.' } } } } },
    };

    expect(pluralMismatches('en', planted)).toEqual([
      { key: 'videos.rank', missing: ['few', 'one', 'two'], extra: [] },
    ]);
  });

  it.each(APPS)('finds no mismatch in the $app source catalogue', ({ source }) => {
    expect(pluralMismatches(LOCALES.source, source)).toEqual([]);
  });

  it.each(
    APPS.flatMap(({ app, load }) =>
      LOCALES.tags
        .filter((locale) => locale !== LOCALES.source)
        .map((locale) => ({ app, load, locale }))
    )
  )('finds no mismatch in the $app $locale translation', async ({ load, locale }) => {
    expect(pluralMismatches(locale, await load(locale))).toEqual([]);
  });
});
