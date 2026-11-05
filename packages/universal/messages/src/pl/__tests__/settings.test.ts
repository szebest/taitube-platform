import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl settings', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'settings.title', args: undefined, expected: 'Ustawienia' },
    { key: 'settings.notSaved', args: undefined, expected: 'Nie zapisano na Twoim koncie' },
    { key: 'settings.signIn', args: undefined, expected: 'Zaloguj się' },
    { key: 'settings.retry', args: undefined, expected: 'Spróbuj ponownie' },
    { key: 'settings.sectionTitle', args: { section: 'advanced' }, expected: 'Dopracuj wygląd' },
    { key: 'settings.captionLanguage', args: { language: 'de' }, expected: 'Niemiecki' },
    {
      key: 'settings.followBrowserIn',
      args: { name: 'Polski' },
      expected: 'Zgodnie z przeglądarką (Polski)',
    },
    { key: 'settings.accentPicked', args: { hex: '#336699' }, expected: 'Wybrano #336699' },
    { key: 'settings.resultCount', args: { count: 1 }, expected: '1 ustawienie' },
    { key: 'settings.resultCount', args: { count: 3 }, expected: '3 ustawienia' },
    { key: 'settings.resultCount', args: { count: 5 }, expected: '5 ustawień' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
