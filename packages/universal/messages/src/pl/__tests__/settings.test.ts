import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl settings', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'settings.title', expected: 'Ustawienia' },
    { key: 'settings.notSaved', expected: 'Nie zapisano na Twoim koncie' },
    { key: 'settings.signIn', expected: 'Zaloguj się' },
    { key: 'settings.retry', expected: 'Spróbuj ponownie' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'settings.sectionTitle', args: { section: 'advanced' }, expected: 'Dopracuj wygląd' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'settings.captionLanguage', args: { language: 'de' }, expected: 'Niemiecki' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([{ key: 'settings.localeOption', args: { locale: 'en' }, expected: 'English' }] as const)(
    'renders $key for $args',
    ({ key, args, expected }) => {
      expect(t(key, args)).toEqual({ ok: true, value: expected });
    }
  );

  it.each([
    { key: 'settings.accentPicked', args: { hex: '#336699' }, expected: 'Wybrano #336699' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'settings.resultCount', args: { count: 1 }, expected: '1 ustawienie' },
    { key: 'settings.resultCount', args: { count: 3 }, expected: '3 ustawienia' },
    { key: 'settings.resultCount', args: { count: 5 }, expected: '5 ustawień' },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
