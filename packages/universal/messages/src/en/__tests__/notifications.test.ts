import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en notifications', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'notifications.emptyTitle', expected: 'No notifications yet' },
    {
      key: 'notifications.emptyDescription',
      expected: 'New uploads from channels you follow and replies to your comments will land here.',
    },
    { key: 'notifications.manageSubscriptions', expected: 'Manage subscriptions' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
