import type { PreferencesView } from '@vp/api-contracts';
import type { UserPreferences } from '@vp/domain/settings';

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
  const { userId: _userId, updatedAt, ...document } = stored;
  return { ...document, updatedAt: updatedAt.toISOString() };
}
