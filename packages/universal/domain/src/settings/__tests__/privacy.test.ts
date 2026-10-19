import { PRIVACY_SETTINGS } from '../privacy';

describe('domain/settings: privacy', () => {
  it.each(Object.entries(PRIVACY_SETTINGS))(
    '%s lives on the account alone, where the server acts on it',
    (_, setting) => {
      expect(setting.scope).toBe('account');
    }
  );
});
