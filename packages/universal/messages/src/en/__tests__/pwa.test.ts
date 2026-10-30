import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en pwa', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'pwa.installTitle', expected: 'Install Taitube' },
    { key: 'pwa.installBody', expected: 'Add Taitube to your device to open it like an app.' },
    { key: 'pwa.installAction', expected: 'Install' },
    { key: 'pwa.installDismiss', expected: 'Not now' },
    { key: 'pwa.updateTitle', expected: 'A new version of Taitube is ready' },
    { key: 'pwa.updateAction', expected: 'Reload to update' },
    { key: 'pwa.offlineTitle', expected: 'You are offline' },
    {
      key: 'pwa.offlineDescription',
      expected: 'The feed you already loaded still works. The rest returns with your connection.',
    },
    {
      key: 'pwa.offlineBannerDescription',
      expected: 'The feed you already loaded still works.',
    },
    { key: 'pwa.offlineToastTitle', expected: 'You are offline' },
    {
      key: 'pwa.offlineToastDescription',
      expected: 'The feed you already loaded stays available.',
    },
    { key: 'pwa.offlineFeed', expected: 'Feed' },
    { key: 'pwa.offlineHome', expected: 'Go to Home' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'pwa.offlineFeedCount', count: 1, expected: '1 page' },
    { key: 'pwa.offlineFeedCount', count: 3, expected: '3 pages' },
    {
      key: 'pwa.offlineQueuedChanges',
      count: 1,
      expected: '1 change will sync when the connection returns.',
    },
    {
      key: 'pwa.offlineQueuedChanges',
      count: 4,
      expected: '4 changes will sync when the connection returns.',
    },
  ] as const)('counts $count for $key as "$expected"', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });
});
