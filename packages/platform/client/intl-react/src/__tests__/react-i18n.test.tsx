import { builtInKinds, defineEngine, defineParams } from '@kit/i18n';
import { definePresets } from '@kit/intl';
import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createReactI18n } from '../react-i18n';
import { SpecIntl } from './spec-intl';

const { dt, defineCatalogue, createI18n } = defineEngine({
  kinds: builtInKinds,
  presets: definePresets({}),
  params: defineParams(['count', 'names'] as const),
});

const source = {
  videos: {
    views: dt('{count:plural}', { plural: { count: { one: '{?} view', other: '{?} views' } } }),
    title: dt('Videos'),
    genres: dt('{names:list}', {
      list: { names: { max: 2, more: { other: '{?} more' } } },
    }),
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

  it('hands a list message to useTParts as text and a list part', () => {
    const { result } = renderHook(words.useTParts, {
      wrapper: ({ children }) => (
        <SpecIntl locale="en" timeZone="UTC">
          <words.TranslatorProvider catalogues={{ locale: 'en', source, translations: {} }}>
            {children}
          </words.TranslatorProvider>
        </SpecIntl>
      ),
    });

    expect(result.current('videos.genres', { names: ['A', 'B', 'C', 'D'] })).toMatchObject({
      ok: true,
      value: [{ type: 'list', name: 'names', detail: { hidden: ['C', 'D'], total: 4 } }],
    });
  });

  it.each([
    { id: 'videos.title', args: {}, text: 'Videos', trigger: null },
    {
      id: 'videos.genres',
      args: { names: ['A', 'B', 'C', 'D'] },
      text: 'A, B, and 2 more',
      trigger: '2 more',
    },
  ] as const)('renders $id as React', ({ id, args, text, trigger }) => {
    const { Message } = words;
    const { container } = render(
      <SpecIntl locale="en" timeZone="UTC">
        <words.TranslatorProvider catalogues={{ locale: 'en', source, translations: {} }}>
          <Message id={id} args={args} />
        </words.TranslatorProvider>
      </SpecIntl>
    );

    expect(container.textContent).toBe(text);
    expect(screen.queryAllByRole('button').map((button) => button.textContent)).toEqual(
      trigger === null ? [] : [trigger]
    );
  });
});
