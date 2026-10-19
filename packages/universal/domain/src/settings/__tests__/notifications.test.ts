import { NOTIFICATION_SETTINGS } from '../notifications';

describe('domain/settings: notifications', () => {
  it.each(Object.entries(NOTIFICATION_SETTINGS))(
    '%s lives on the account alone, where the server acts on it',
    (_, setting) => {
      expect(setting.scope).toBe('account');
    }
  );
});
