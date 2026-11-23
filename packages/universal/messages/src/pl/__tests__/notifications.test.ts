import { translatorFor } from '../../__tests__/web-fixtures';
import { pl } from '../web';

describe('@vp/messages: pl notifications', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'notifications.emptyTitle', expected: 'Nie masz jeszcze powiadomień' },
    { key: 'notifications.manageSubscriptions', expected: 'Zarządzaj subskrypcjami' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
