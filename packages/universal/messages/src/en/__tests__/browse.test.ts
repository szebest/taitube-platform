import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en browse', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'browse.untitled', expected: 'Untitled video' },
    { key: 'browse.empty', expected: 'No videos here yet' },
    { key: 'browse.loadMoreFailed', expected: 'More videos could not be loaded' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
