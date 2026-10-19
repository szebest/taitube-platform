import {
  APPEARANCE_SETTINGS,
  NOTIFICATION_SETTINGS,
  PLAYBACK_SETTINGS,
  PRIVACY_SETTINGS,
  type Setting,
} from '@vp/domain/settings';
import { isSettingValue, MAX_TOKEN_OVERRIDES } from '../setting-checks';

const groups = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`group${index}`, 'compact']));

describe('@vp/domain-rules: isSettingValue', () => {
  it.each<{ path: string; setting: Setting; value: unknown; accepted: boolean }>([
    {
      path: 'appearance.theme',
      setting: APPEARANCE_SETTINGS.theme,
      value: 'nocturne-2',
      accepted: true,
    },
    { path: 'appearance.theme', setting: APPEARANCE_SETTINGS.theme, value: null, accepted: true },
    {
      path: 'appearance.theme',
      setting: APPEARANCE_SETTINGS.theme,
      value: 'Sand',
      accepted: false,
    },
    {
      path: 'appearance.theme',
      setting: APPEARANCE_SETTINGS.theme,
      value: `a${'b'.repeat(32)}`,
      accepted: false,
    },
    { path: 'appearance.mode', setting: APPEARANCE_SETTINGS.mode, value: 'oled', accepted: true },
    { path: 'appearance.mode', setting: APPEARANCE_SETTINGS.mode, value: 'dim', accepted: false },
    {
      path: 'appearance.accent',
      setting: APPEARANCE_SETTINGS.accent,
      value: '#a1b2c3',
      accepted: true,
    },
    {
      path: 'appearance.accent',
      setting: APPEARANCE_SETTINGS.accent,
      value: '#abc',
      accepted: false,
    },
    {
      path: 'appearance.accent',
      setting: APPEARANCE_SETTINGS.accent,
      value: 'red',
      accepted: false,
    },
    {
      path: 'appearance.overrides',
      setting: APPEARANCE_SETTINGS.overrides,
      value: { fontSize: 'large', spacing: 'compact' },
      accepted: true,
    },
    {
      path: 'appearance.overrides',
      setting: APPEARANCE_SETTINGS.overrides,
      value: groups(MAX_TOKEN_OVERRIDES),
      accepted: true,
    },
    {
      path: 'appearance.overrides',
      setting: APPEARANCE_SETTINGS.overrides,
      value: groups(MAX_TOKEN_OVERRIDES + 1),
      accepted: false,
    },
    {
      path: 'appearance.overrides',
      setting: APPEARANCE_SETTINGS.overrides,
      value: { 'font-size': 'large' },
      accepted: false,
    },
    {
      path: 'appearance.overrides',
      setting: APPEARANCE_SETTINGS.overrides,
      value: { spacing: 'Very Compact' },
      accepted: false,
    },
    { path: 'playback.quality', setting: PLAYBACK_SETTINGS.quality, value: '720p', accepted: true },
    { path: 'playback.quality', setting: PLAYBACK_SETTINGS.quality, value: '4k', accepted: false },
    { path: 'playback.speed', setting: PLAYBACK_SETTINGS.speed, value: 1.25, accepted: true },
    { path: 'playback.speed', setting: PLAYBACK_SETTINGS.speed, value: 1.1, accepted: false },
    {
      path: 'playback.captionsLanguage',
      setting: PLAYBACK_SETTINGS.captionsLanguage,
      value: 'pt-BR',
      accepted: true,
    },
    {
      path: 'playback.captionsLanguage',
      setting: PLAYBACK_SETTINGS.captionsLanguage,
      value: 'english!',
      accepted: false,
    },
    {
      path: 'playback.statsOverlay',
      setting: PLAYBACK_SETTINGS.statsOverlay,
      value: 'yes',
      accepted: false,
    },
    {
      path: 'privacy.playlistVisibility',
      setting: PRIVACY_SETTINGS.playlistVisibility,
      value: 'unlisted',
      accepted: true,
    },
    {
      path: 'privacy.playlistVisibility',
      setting: PRIVACY_SETTINGS.playlistVisibility,
      value: 'friends',
      accepted: false,
    },
    {
      path: 'privacy.historyPaused',
      setting: PRIVACY_SETTINGS.historyPaused,
      value: true,
      accepted: true,
    },
    {
      path: 'notifications.repliesAndMentions',
      setting: NOTIFICATION_SETTINGS.repliesAndMentions,
      value: false,
      accepted: true,
    },
    {
      path: 'notifications.repliesAndMentions',
      setting: NOTIFICATION_SETTINGS.repliesAndMentions,
      value: null,
      accepted: false,
    },
  ])('$path takes $value: $accepted', ({ setting, value, accepted }) => {
    expect(isSettingValue(setting, value)).toBe(accepted);
  });
});
