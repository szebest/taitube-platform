import { PLAYBACK_SETTINGS } from '../playback';

describe('domain/settings: playback', () => {
  it.each(Object.entries(PLAYBACK_SETTINGS))(
    '%s lives on the device and the account alike',
    (_, setting) => {
      expect(setting.scope).toBe('both');
    }
  );

  it.each(Object.entries(PLAYBACK_SETTINGS))(
    '%s is kept in localStorage, which a playback field can wait for after hydration',
    (_, setting) => {
      expect(setting.device).toBe('storage');
    }
  );

  it('plays the frame preview on a card unless told not to', () => {
    expect(PLAYBACK_SETTINGS.hoverPlay).toMatchObject({ type: 'flag', default: true });
  });
});
