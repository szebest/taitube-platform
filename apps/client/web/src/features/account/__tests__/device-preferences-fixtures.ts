import type { DevicePreferences } from '#app/features/account/utils/device-preferences';

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  schema: 1,
  playback: {
    quality: 'auto',
    speed: 1,
    autoplayNext: true,
    hoverPreview: true,
    captionsOn: false,
    captionsLanguage: null,
    captionsSize: 'medium',
    captionsBackground: 'translucent',
    statsOverlay: false,
  },
  locale: null,
};
