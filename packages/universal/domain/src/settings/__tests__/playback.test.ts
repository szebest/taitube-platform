import { PLAYBACK_SETTINGS } from '../playback';

describe('domain/settings: playback', () => {
  it.each(Object.entries(PLAYBACK_SETTINGS))(
    '%s lives on the device and the account alike',
    (_, setting) => {
      expect(setting.scope).toBe('both');
    }
  );
});
