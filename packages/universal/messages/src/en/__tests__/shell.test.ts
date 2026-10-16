import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en shell', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'shell.search', expected: 'Search' },
    { key: 'shell.clearSearch', expected: 'Clear search' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
