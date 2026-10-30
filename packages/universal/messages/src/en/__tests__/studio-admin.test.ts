import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio admin', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.adminNav', expected: 'Admin' },
    { key: 'studio.adminDeniedTitle', expected: 'Access denied' },
    { key: 'studio.adminCategoryNew', expected: 'New category' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
