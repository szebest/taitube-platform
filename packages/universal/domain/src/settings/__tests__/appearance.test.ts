import { APPEARANCE_SETTINGS } from '../appearance';

describe('domain/settings: appearance', () => {
  it.each(Object.entries(APPEARANCE_SETTINGS))(
    '%s lives on the device and the account alike',
    (_, setting) => {
      expect(setting.scope).toBe('both');
    }
  );

  it.each(Object.entries(APPEARANCE_SETTINGS))(
    '%s is kept in the cookie the server reads before the first paint',
    (_, setting) => {
      expect(setting.device).toBe('cookie');
    }
  );

  it('follows the system contrast until the viewer picks one', () => {
    expect(APPEARANCE_SETTINGS.contrast.default).toBe('auto');
    expect(APPEARANCE_SETTINGS.contrast.options).toEqual(['auto', 'standard', 'more']);
  });
});
