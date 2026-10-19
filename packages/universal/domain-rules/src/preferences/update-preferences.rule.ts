import {
  PREFERENCE_SECTIONS,
  type Preferences,
  type PreferencesPatch,
  type UserPreferences,
} from '@vp/domain/settings';
import { err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import { type PreferencesConflict, preferencesConflict } from './failures';
import { mergePreferences } from './merge-preferences';
import { isSettingValue } from './setting-checks';

export interface UpdatePreferencesInput {
  readonly userId: string;
  readonly current: UserPreferences | null;
  readonly version: number;
  readonly patch: PreferencesPatch;
}

export type UpdatePreferencesFailure = PreferencesConflict | InvalidField;

const SECTIONS = new Map(Object.entries(PREFERENCE_SECTIONS));

function firstInvalidField(preferences: Preferences): string | null {
  for (const [section, values] of Object.entries(preferences)) {
    if (!values) continue;
    const stored = new Map(Object.entries(values));
    for (const [key, setting] of Object.entries(SECTIONS.get(section) ?? {})) {
      if (!isSettingValue(setting, stored.get(key))) return `${section}.${key}`;
    }
  }
  return null;
}

/**
 * Checks the merged document rather than the patch, so a value is held to its setting however it got
 * there and token overrides cannot grow past their cap one request at a time. An account with nothing
 * stored is at version 0.
 */
export function decidePreferencesUpdate(
  input: UpdatePreferencesInput
): Result<Preferences, UpdatePreferencesFailure> {
  const { userId, current, version, patch } = input;
  if ((current?.version ?? 0) !== version) return err(preferencesConflict(userId, current));

  const merged = mergePreferences(current, patch);
  const field = firstInvalidField(merged);
  return field
    ? err(invalidField(field, `${field} is not a value this setting accepts`, {}))
    : ok(merged);
}
