import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl pwa', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'pwa.installTitle', expected: 'Zainstaluj Taitube' },
    { key: 'pwa.offlineTitle', expected: 'Jesteś offline' },
    { key: 'pwa.saveOffline', expected: 'Zapisz do oglądania offline' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'pwa.offlineFeedCount', args: { count: 1 }, expected: '1 strona' },
    { key: 'pwa.offlineFeedCount', args: { count: 3 }, expected: '3 strony' },
    { key: 'pwa.offlineFeedCount', args: { count: 5 }, expected: '5 stron' },
    {
      key: 'pwa.offlineQueuedChanges',
      args: { count: 2 },
      expected: '2 zmiany zostaną zsynchronizowane po przywróceniu połączenia.',
    },
    {
      key: 'pwa.offlineQueuedChanges',
      args: { count: 12 },
      expected: '12 zmian zostanie zsynchronizowanych po przywróceniu połączenia.',
    },
    {
      key: 'pwa.saveOfflineLimit',
      args: { count: 1 },
      expected: '1 film jest już zapisany. Usuń go, aby zapisać kolejny.',
    },
  ] as const)('renders $key for $args', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
