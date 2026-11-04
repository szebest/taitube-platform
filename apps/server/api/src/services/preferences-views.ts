import type { PreferencesView } from '@vp/api-contracts';
import {
  DEFAULT_PREFERENCES,
  type PreferenceSection,
  type Preferences,
  type UserPreferences,
} from '@vp/domain/settings';

const withDefaults = <S extends PreferenceSection>(section: S, stored: Preferences[S]) =>
  stored && { ...DEFAULT_PREFERENCES[section], ...stored };

export function toPreferencesView(stored: UserPreferences | null): PreferencesView {
  if (!stored) {
    return {
      appearance: null,
      playback: null,
      privacy: null,
      notifications: null,
      version: 0,
      updatedAt: null,
    };
  }
  const { userId: _userId, updatedAt, version, ...sections } = stored;
  return {
    appearance: withDefaults('appearance', sections.appearance),
    playback: withDefaults('playback', sections.playback),
    privacy: withDefaults('privacy', sections.privacy),
    notifications: withDefaults('notifications', sections.notifications),
    version,
    updatedAt: updatedAt.toISOString(),
  };
}
