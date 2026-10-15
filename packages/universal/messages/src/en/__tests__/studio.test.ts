import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.title', expected: 'Creator Studio' },
    { key: 'studio.backToWeb', expected: 'Back to Taitube' },
    { key: 'studio.signInRequired', expected: 'Sign in on Taitube to use the studio' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
