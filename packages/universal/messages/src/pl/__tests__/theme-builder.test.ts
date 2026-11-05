import { translatorFor } from '../../__tests__/fixtures';
import { pl } from '..';

describe('@vp/messages: pl themeBuilder', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'themeBuilder.ground', values: {}, expected: 'Kolor strony w Twoim motywie' },
    { key: 'themeBuilder.accent', values: {}, expected: 'Akcent Twojego motywu' },
    { key: 'themeBuilder.use', values: {}, expected: 'Użyj tego motywu' },
    {
      key: 'themeBuilder.passes',
      values: {},
      expected: 'Każda para tekstu i obrysu jest czytelna.',
    },
    {
      key: 'themeBuilder.fails',
      values: { count: 3 },
      expected: 'Ten motyw nie został zapisany: pary poniżej progu kontrastu: 3.',
    },
    {
      key: 'themeBuilder.refused',
      values: {},
      expected:
        'Ten motyw nie został zapisany: wybierz ciemniejszy lub jaśniejszy kolor strony, by akcenty były na nim czytelne.',
    },
    {
      key: 'themeBuilder.failure',
      values: { mode: 'dark', label: 'fg-muted on bg', ratio: 3.24, floor: 4.5 },
      expected: 'dark: fg-muted on bg, 3,2:1 z 4,5:1',
    },
  ] as const)('words $key', ({ key, values, expected }) => {
    expect(t(key, values)).toEqual({ ok: true, value: expected });
  });
});
