import { APPEARANCE_SETTINGS } from '../appearance';

describe('domain/settings: appearance', () => {
  it.each(Object.entries(APPEARANCE_SETTINGS))(
    '%s lives on the device and the account alike',
    (_, setting) => {
      expect(setting.scope).toBe('both');
    }
  );
});
