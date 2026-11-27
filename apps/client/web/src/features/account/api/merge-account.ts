import type { PreferencesView } from '@vp/api-contracts';
import {
  type AppearancePreferences,
  DEFAULT_PREFERENCES,
  type PlaybackPreferences,
} from '@vp/domain/settings';
import { isFields, type PreferencesChange } from '#app/lib/preferences/preferences-change';

export type DeviceSections = Readonly<{
  appearance: AppearancePreferences;
  playback: PlaybackPreferences;
}>;

/** A field the viewer changed here while signed out, which the account holds a different value for. */
export type MergeConflict = Readonly<{
  path: string;
  /** What the account held, which Undo brings back. */
  account: unknown;
}>;

export type MergePlan = Readonly<{
  /** The device's sections once the account's fields are taken over; a section no field changed is absent. */
  toDevice: Partial<DeviceSections>;
  /** The fields of the device the account has not got, or that the viewer chose here, to send as they are. */
  upload: PreferencesChange;
  conflicts: readonly MergeConflict[];
}>;

type Fields = Readonly<Record<string, unknown>>;

type Leaf = Readonly<{ key: string; group?: string; value: unknown }>;

const OVERRIDES = 'overrides';

function sameValue(left: unknown, right: unknown): boolean {
  if (isFields(left) && isFields(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every((key) => sameValue(left[key], right[key]));
  }
  return Object.is(left, right);
}

const pathOf = (section: string, { key, group }: Leaf) =>
  group === undefined ? `${section}.${key}` : `${section}.${key}.${group}`;

function overrideGroups(...sections: Fields[]): string[] {
  return [
    ...new Set(
      sections.flatMap((section) =>
        Object.keys(isFields(section.overrides) ? section.overrides : {})
      )
    ),
  ];
}

function valueAt(section: Fields, key: string, group: string | undefined): unknown {
  const value = section[key];
  if (group === undefined) return value;
  return isFields(value) ? value[group] : undefined;
}

function withLeaf(section: Fields, { key, group, value }: Leaf): Fields {
  if (group === undefined) return { ...section, [key]: value };

  const held = isFields(section[key]) ? section[key] : {};
  const { [group]: _dropped, ...rest } = held;
  return { ...section, [key]: value === undefined ? rest : { ...rest, [group]: value } };
}

function uploadOf(leaf: Leaf): Fields {
  const value = leaf.value === undefined ? null : leaf.value;
  return leaf.group === undefined ? { [leaf.key]: value } : { [leaf.key]: { [leaf.group]: value } };
}

function mergeUpload(base: Fields, next: Fields): Fields {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    const held = merged[key];
    merged[key] = isFields(held) && isFields(value) ? { ...held, ...value } : value;
  }
  return merged;
}

function planSection(
  name: string,
  accountSection: Fields | null,
  device: Fields,
  defaults: Fields,
  dirty: ReadonlySet<string>,
  firstMerge: boolean
): { section: Fields | undefined; upload: Fields | undefined; conflicts: MergeConflict[] } {
  const keys = Object.keys(defaults).filter((key) => key !== OVERRIDES);
  const everyLeaf: Leaf[] = [
    ...keys.map((key) => ({ key, value: undefined })),
    ...overrideGroups(device, accountSection ?? {}).map((group) => ({
      key: OVERRIDES,
      group,
      value: undefined,
    })),
  ];
  let section: Fields = device;
  let upload: Fields = {};
  let changed = false;
  const conflicts: MergeConflict[] = [];

  for (const leaf of everyLeaf) {
    const path = pathOf(name, leaf);
    const here = valueAt(device, leaf.key, leaf.group);
    const there = accountSection ? valueAt(accountSection, leaf.key, leaf.group) : undefined;
    const fallback = valueAt(defaults, leaf.key, leaf.group);

    if (accountSection === null) {
      const worthSending = dirty.has(path) || (firstMerge && !sameValue(here, fallback));
      if (worthSending && !sameValue(here, there)) {
        upload = mergeUpload(upload, uploadOf({ ...leaf, value: here }));
      }
      continue;
    }
    if (sameValue(here, there)) continue;

    if (dirty.has(path)) {
      upload = mergeUpload(upload, uploadOf({ ...leaf, value: here }));
      conflicts.push({ path, account: there });
    } else {
      section = withLeaf(section, { ...leaf, value: there });
      changed = true;
    }
  }

  return {
    section: changed ? section : undefined,
    upload: Object.keys(upload).length > 0 ? upload : undefined,
    conflicts,
  };
}

/**
 * The account's fields over the device's, field by field. A field changed on this device while signed
 * out (`dirty`) goes up and wins, and raises a conflict when the account held another value; every other
 * field takes the account's. A field of a section the account never saved goes up when it was chosen
 * here, or on the first merge of a sign-in when it is not the default.
 */
export function planMerge(
  account: PreferencesView,
  device: DeviceSections,
  dirty: ReadonlySet<string>,
  firstMerge: boolean
): MergePlan {
  const toDevice: { -readonly [S in keyof DeviceSections]?: DeviceSections[S] } = {};
  const upload: PreferencesChange = {};
  const conflicts: MergeConflict[] = [];

  const appearance = planSection(
    'appearance',
    account.appearance,
    device.appearance,
    DEFAULT_PREFERENCES.appearance,
    dirty,
    firstMerge
  );
  if (appearance.section) toDevice.appearance = appearance.section as AppearancePreferences;
  if (appearance.upload) upload.appearance = appearance.upload as PreferencesChange['appearance'];
  conflicts.push(...appearance.conflicts);

  const playback = planSection(
    'playback',
    account.playback,
    device.playback,
    DEFAULT_PREFERENCES.playback,
    dirty,
    firstMerge
  );
  if (playback.section) toDevice.playback = playback.section as PlaybackPreferences;
  if (playback.upload) upload.playback = playback.upload as PreferencesChange['playback'];
  conflicts.push(...playback.conflicts);

  return { toDevice, upload, conflicts };
}
