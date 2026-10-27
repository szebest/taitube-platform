import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en shell', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'shell.search', expected: 'Search' },
    { key: 'shell.brandHome', expected: 'Taitube home' },
    { key: 'shell.menu', expected: 'Menu' },
    { key: 'shell.navigation', expected: 'Main' },
    { key: 'shell.home', expected: 'Home' },
    { key: 'shell.shorts', expected: 'Shorts' },
    { key: 'shell.live', expected: 'Live' },
    { key: 'shell.goTo', expected: 'Go to' },
    { key: 'shell.trending', expected: 'Trending' },
    { key: 'shell.subscriptions', expected: 'Subscriptions' },
    { key: 'shell.you', expected: 'You' },
    { key: 'shell.yourChannel', expected: 'Your channel' },
    { key: 'shell.yourVideos', expected: 'Your videos' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
