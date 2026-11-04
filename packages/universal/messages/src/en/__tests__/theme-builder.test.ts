import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en themeBuilder', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'themeBuilder.ground', values: {}, expected: 'Page colour of your theme' },
    { key: 'themeBuilder.accent', values: {}, expected: 'Accent of your theme' },
    { key: 'themeBuilder.use', values: {}, expected: 'Use this theme' },
    {
      key: 'themeBuilder.passes',
      values: {},
      expected: 'Every text and outline pair is readable.',
    },
    {
      key: 'themeBuilder.fails',
      values: { count: 3 },
      expected: 'This theme is not saved: 3 pairs are under their contrast floor.',
    },
    {
      key: 'themeBuilder.failure',
      values: { mode: 'dark', label: 'fg-muted on bg', ratio: 3.24, floor: 4.5 },
      expected: 'dark: fg-muted on bg, 3.2:1 of 4.5:1',
    },
  ] as const)('words $key', ({ key, values, expected }) => {
    expect(t(key, values)).toEqual({ ok: true, value: expected });
  });
});
