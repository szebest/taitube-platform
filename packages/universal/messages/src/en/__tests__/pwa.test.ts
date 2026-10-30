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
    { count: 1, expected: '1 page' },
    { count: 3, expected: '3 pages' },
  ])('counts $count cached feed pages as "$expected"', ({ count, expected }) => {
    expect(t('pwa.offlineFeedCount', { count })).toEqual({ ok: true, value: expected });
  });
});
