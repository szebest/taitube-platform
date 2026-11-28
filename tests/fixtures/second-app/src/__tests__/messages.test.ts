import { createRegistry } from '@kit/di';
import { Catalogues } from '@kit/i18n';
import { createIntl, createIntlCache, FormatPresets, resolveEntry } from '@kit/intl';
import { SHOP_CATALOGUES, SHOP_PRESETS, shopI18n } from '../messages';

const intlFor = (locale: string) =>
  createIntl({ locale, timeZone: 'UTC', cache: createIntlCache() });

describe('quill shop messages, on @kit/i18n and @kit/intl', () => {
  it.each([
    { locale: 'fi-FI', key: 'shelf.stock', args: { copies: 1 }, expected: '1 kappale' },
    { locale: 'fi-FI', key: 'shelf.stock', args: { copies: 1234 }, expected: '1234 kappaletta' },
    { locale: 'ar-EG', key: 'shelf.heading', args: { title: 'روايات' }, expected: 'رف الكتب: روايات' },
    { locale: 'ar-EG', key: 'shelf.stock', args: { copies: 2 }, expected: '٢ kappaletta' },
  ] as const)('renders $key in $locale along the chain', ({ locale, key, args, expected }) => {
    const { tOr } = shopI18n.createTranslator(intlFor(locale), SHOP_CATALOGUES);

    expect(tOr(key, args, '')).toBe(expected);
  });

  it.each([
    { chain: ['ar-EG', 'fi-FI'], expected: { useGrouping: true } },
    { chain: ['fi-FI'], expected: { useGrouping: false } },
  ])('resolves its own preset along $chain', ({ chain, expected }) => {
    expect(resolveEntry(SHOP_PRESETS, 'number', 'tally', chain)).toEqual({
      ok: true,
      value: expected,
    });
  });

  it('provides its catalogues and presets for a registry to read back', () => {
    const registry = createRegistry().provide(...shopI18n.providers(SHOP_CATALOGUES));

    expect(registry.get(Catalogues)).toMatchObject({ ok: true, value: { locale: 'fi-FI' } });
    expect(registry.get(FormatPresets)).toEqual({ ok: true, value: SHOP_PRESETS });
  });
});
