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
    { key: 'pwa.saveOffline', expected: 'Save for offline' },
    { key: 'pwa.savedOffline', expected: 'Saved for offline' },
    { key: 'pwa.saveOfflineDone', expected: 'Saved for offline' },
    { key: 'pwa.saveOfflineRemoved', expected: 'Removed from offline' },
    { key: 'pwa.saveOfflineFailed', expected: 'This video could not be saved for offline.' },
    {
      key: 'pwa.saveOfflineQuota',
      expected: 'There is not enough storage on this device to save this video.',
    },
    {
      key: 'pwa.saveOfflineUnavailable',
      expected: 'This video has no version that can be saved yet.',
    },
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
    {
      key: 'pwa.saveOfflineLimit',
      count: 1,
      expected: '1 video is saved already. Remove it to save another.',
    },
    {
      key: 'pwa.saveOfflineLimit',
      count: 10,
      expected: '10 videos are saved already. Remove one to save another.',
    },
  ] as const)('counts $count for $key as "$expected"', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });
});
