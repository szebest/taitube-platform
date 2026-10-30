import type { DevicePreferences } from '#app/features/settings/device/device-preferences';

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  schema: 1,
  playback: {
    quality: 'auto',
    speed: 1,
    autoplayNext: true,
    hoverPreview: true,
    captionsOn: false,
    captionsLanguage: null,
    statsOverlay: false,
  },
  locale: null,
};
