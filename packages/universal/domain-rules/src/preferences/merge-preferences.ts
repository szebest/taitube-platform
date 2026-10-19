import {
  DEFAULT_PREFERENCES,
  type MergePatch,
  mapSection,
  PREFERENCE_SECTIONS,
  type PreferenceSection,
  type Preferences,
  type PreferencesPatch,
  type SectionValues,
  type Setting,
} from '@vp/domain/settings';

type Section<S extends PreferenceSection> = SectionValues<(typeof PREFERENCE_SECTIONS)[S]>;

function mergeOverrides(stored: unknown, patch: object): Readonly<Record<string, string>> {
  const merged = new Map(Object.entries(typeof stored === 'object' && stored ? stored : {}));
  for (const [group, set] of Object.entries(patch)) {
    if (set === null) merged.delete(group);
    else if (set !== undefined) merged.set(group, set);
  }
  return Object.fromEntries(merged);
}

function mergeValue(setting: Setting, stored: unknown, patched: unknown): unknown {
  if (patched === undefined) return stored;
  if (patched === null) return setting.default;
  return setting.type === 'tokenOverrides' && typeof patched === 'object'
    ? mergeOverrides(stored, patched)
    : patched;
}

function mergeSection<S extends PreferenceSection>(
  section: S,
  stored: Section<S> | null,
  patch: MergePatch<Section<S>> | null | undefined
): Section<S> | null {
  if (patch === undefined) return stored;
  if (patch === null) return null;
  const current = new Map(Object.entries(stored ?? DEFAULT_PREFERENCES[section]));
  const changes = new Map(Object.entries(patch));
  return mapSection<Section<S>>(PREFERENCE_SECTIONS[section], (setting, key) =>
    mergeValue(setting, current.get(key), changes.get(key))
  );
}

/**
 * A section left out stays as stored and `null` clears it. Inside a section a field left out stays,
 * `null` puts its default back, and the first save of a section starts from the defaults.
 */
export function mergePreferences(stored: Preferences | null, patch: PreferencesPatch): Preferences {
  return {
    appearance: mergeSection('appearance', stored?.appearance ?? null, patch.appearance),
    playback: mergeSection('playback', stored?.playback ?? null, patch.playback),
    privacy: mergeSection('privacy', stored?.privacy ?? null, patch.privacy),
    notifications: mergeSection(
      'notifications',
      stored?.notifications ?? null,
      patch.notifications
    ),
  };
}
