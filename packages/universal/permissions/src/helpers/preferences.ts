import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { PreferencesResource, UserContext } from '../types/index';

interface PreferencesCheck {
  user: UserContext | null;
  preferences: PreferencesResource;
}

export function canReadPreferences({ user, preferences }: PreferencesCheck): boolean {
  return getUserPermissions(user).can('read', subject('Preferences', { ...preferences }));
}

export function canUpdatePreferences({ user, preferences }: PreferencesCheck): boolean {
  return getUserPermissions(user).can('update', subject('Preferences', { ...preferences }));
}
