import { builtInKinds, defineEngine, definePresets, defineParams } from '@kit/i18n';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createReactI18n } from '../react-i18n';
import { SpecIntl } from './spec-intl';

const { dt, defineCatalogue, createI18n } = defineEngine({
  kinds: builtInKinds,
  presets: definePresets({}),
  params: defineParams(['count'] as const),
});

const source = {
  videos: {
    views: dt('{count:plural}', { plural: { count: { one: '{?} view', other: '{?} views' } } }),
    title: dt('Videos'),
  },
} as const;

const sv = defineCatalogue<typeof source>()({ videos: { title: dt('Filmer') } });

const words = createReactI18n(createI18n<typeof source>());

function renderUseT(locale: string, mounted: 'both' | 'intl only' | 'none' = 'both') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SpecIntl locale={locale} timeZone="UTC">
      {mounted === 'both' ? (
        <words.TranslatorProvider catalogues={{ locale: 'en', source, translations: { sv } }}>
          {children}
        </words.TranslatorProvider>
      ) : (
        children
      )}
    </SpecIntl>
  );
  return renderHook(words.useT, mounted === 'none' ? undefined : { wrapper });
}

describe('@kit/intl-react: createReactI18n', () => {
  it.each([
    { locale: 'en', key: 'videos.title', expected: 'Videos' },
    { locale: 'sv', key: 'videos.title', expected: 'Filmer' },
    { locale: 'sv', key: 'videos.views', expected: '2 views' },
  ] as const)('renders $key in $locale along the chain', ({ locale, key, expected }) => {
    const { tOr } = renderUseT(locale).result.current;

    expect(tOr(key, { count: 2 }, '')).toBe(expected);
  });

  it.each([
    { mounted: 'intl only', missing: 'useT must be called inside <TranslatorProvider>' },
    { mounted: 'none', missing: 'useT must be called inside <TranslatorProvider>' },
  ] as const)('fails loudly with $mounted mounted, naming the provider', ({ mounted, missing }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderUseT('en', mounted)).toThrow(missing);
  });

  it('fails loudly when the translator provider has no IntlProvider above it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = ({ children }: { children: ReactNode }) => (
      <words.TranslatorProvider catalogues={{ locale: 'en', source, translations: {} }}>
        {children}
      </words.TranslatorProvider>
    );

    expect(() => renderHook(words.useT, { wrapper })).toThrow(
      'TranslatorProvider must be called inside <IntlProvider>'
    );
  });
});
