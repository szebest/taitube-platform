import type { PreferencesView, UpdatePreferencesBody } from '@vp/api-contracts';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';

/** What one save sends: the sections and fields that changed, never the `version`. */
export type PreferencesChange = Omit<UpdatePreferencesBody, 'version'>;

type Fields = Readonly<Record<string, unknown>>;

export function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeFields(base: Fields, next: Fields): Fields {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    const current = merged[key];
    merged[key] = isFields(current) && isFields(value) ? mergeFields(current, value) : value;
  }
  return merged;
}

function mergeSection<T extends Fields>(
  base: T | null | undefined,
  next: T | null | undefined
): T | undefined {
  if (!base) return next ?? undefined;
  if (!next) return base;
  return mergeFields(base, next) as T;
}

/** Two changes as one: later fields win, overrides merge by token group. */
export function mergeChanges(base: PreferencesChange, next: PreferencesChange): PreferencesChange {
  return {
    appearance: mergeSection(base.appearance, next.appearance),
    playback: mergeSection(base.playback, next.playback),
    privacy: mergeSection(base.privacy, next.privacy),
    notifications: mergeSection(base.notifications, next.notifications),
  };
}

function applyField(current: unknown, value: unknown, fallback: unknown): unknown {
  if (value === null) return fallback;
  if (!(isFields(value) && isFields(current))) return value;

  const merged: Record<string, unknown> = { ...current };
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null) delete merged[key];
    else merged[key] = entry;
  }
  return merged;
}

function applySection<T extends Fields>(
  stored: T | null,
  change: Fields | null | undefined,
  defaults: T
): T | null {
  if (!change) return stored;

  const base: Fields = stored ?? defaults;
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(change)) {
    next[key] = applyField(base[key], value, defaults[key]);
  }
  return next as T;
}

/** The document as the server will hold it once `change` is saved, at the version it was read at. */
export function applyChange(view: PreferencesView, change: PreferencesChange): PreferencesView {
  return {
    ...view,
    appearance: applySection(view.appearance, change.appearance, DEFAULT_PREFERENCES.appearance),
    playback: applySection(view.playback, change.playback, DEFAULT_PREFERENCES.playback),
    privacy: applySection(view.privacy, change.privacy, DEFAULT_PREFERENCES.privacy),
    notifications: applySection(
      view.notifications,
      change.notifications,
      DEFAULT_PREFERENCES.notifications
    ),
  };
}

/** The setting paths a change touches, such as `playback.speed` or `appearance.overrides.radius`. */
export function changedPaths(change: PreferencesChange): string[] {
  return Object.entries(change).flatMap(([section, fields]) =>
    Object.entries(fields ?? {}).flatMap(([field, value]) =>
      field === 'overrides' && isFields(value)
        ? Object.keys(value).map((group) => `${section}.overrides.${group}`)
        : [`${section}.${field}`]
    )
  );
}
