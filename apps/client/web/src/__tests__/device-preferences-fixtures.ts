import type { DevicePreferences } from '../lib/preferences/device-preferences';

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  schema: 2,
  playback: {
    quality: 'auto',
    speed: 1,
    autoplayNext: true,
    hoverPreview: true,
    hoverPlay: true,
    captionsOn: false,
    captionsLanguage: null,
    captionsSize: 'medium',
    captionsBackground: 'translucent',
    statsOverlay: false,
  },
  locale: null,
};
