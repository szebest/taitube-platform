import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en feed', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'feed.empty', expected: 'No videos here yet' },
    { key: 'feed.loadMoreFailed', expected: 'More videos could not be loaded' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
