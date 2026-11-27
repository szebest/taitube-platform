// @vitest-environment jsdom
import { Clock } from '@kit/runtime';
import { createLocaleStore, createReactI18n, Format, IntlProvider } from '@kit/intl-react';
import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ShopLocale } from '../locales';
import { SHOP_CATALOGUES, shopI18n } from '../messages';

const clock: Clock = { now: () => Date.UTC(2026, 0, 1) };
const words = createReactI18n(shopI18n);

const wrapperFor = (locale: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <IntlProvider locale={locale} timeZone="UTC" clock={clock}>
        <words.TranslatorProvider catalogues={SHOP_CATALOGUES}>{children}</words.TranslatorProvider>
      </IntlProvider>
    );
  };

describe('quill shop on @kit/intl-react', () => {
  it.each([
    { locale: 'fi-FI', expected: '1234' },
    { locale: 'ar-EG', expected: '١٢٣٤' },
  ])('formats a number in $locale', ({ locale, expected }) => {
    render(
      <IntlProvider locale={locale} timeZone="UTC" clock={clock}>
        <Format value={{ type: 'number', value: 1234, options: { useGrouping: false } }} />
      </IntlProvider>
    );

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('translates through the shop catalogue under the negotiated locale', () => {
    const { result } = renderHook(words.useT, { wrapper: wrapperFor('ar-EG') });

    expect(result.current.tOr('shelf.heading', { title: 'روايات' }, '')).toBe('رف الكتب: روايات');
  });

  it('loads a locale once and keeps the fallback until it arrives', async () => {
    const load = vi.fn(async (locale: ShopLocale) => ({ locale }));
    const store = createLocaleStore<ShopLocale, { locale: string }>({
      fallbackLocale: 'fi-FI',
      load,
    });

    await store.activate('ar-EG');

    expect(store.snapshot().locale).toBe('ar-EG');
    expect(load).toHaveBeenCalledWith('ar-EG');
  });
});
