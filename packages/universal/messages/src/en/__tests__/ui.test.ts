import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en ui', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'ui.close', expected: 'Close' },
    { key: 'ui.loading', expected: 'Loading' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
