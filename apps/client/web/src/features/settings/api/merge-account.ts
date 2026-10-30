import type { PreferencesView } from '@vp/api-contracts';
import {
  type AppearancePreferences,
  DEFAULT_PREFERENCES,
  type PlaybackPreferences,
} from '@vp/domain/settings';

import { isFields, type PreferencesChange } from './preferences-change';

export type DeviceSections = Readonly<{
  appearance: AppearancePreferences;
  playback: PlaybackPreferences;
}>;

export type MergePlan = Readonly<{
  /** The account's sections, which replace the device's. */
  toDevice: Partial<DeviceSections>;
  /** The device's sections the account has never saved, to send as they are. */
  upload: PreferencesChange;
}>;

function sameValue(left: unknown, right: unknown): boolean {
  if (isFields(left) && isFields(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every((key) => sameValue(left[key], right[key]));
  }
  return Object.is(left, right);
}

/**
 * Account over device, section by section. A section the account never saved goes up from the
 * device on the first merge of a sign-in, unless the device has nothing but the defaults to send.
 */
export function planMerge(
  account: PreferencesView,
  device: DeviceSections,
  firstMerge: boolean
): MergePlan {
  const toDevice: { -readonly [S in keyof DeviceSections]?: DeviceSections[S] } = {};
  const upload: PreferencesChange = {};

  if (account.appearance) {
    toDevice.appearance = account.appearance;
  } else if (firstMerge && !sameValue(device.appearance, DEFAULT_PREFERENCES.appearance)) {
    upload.appearance = device.appearance;
  }

  if (account.playback) {
    toDevice.playback = account.playback;
  } else if (firstMerge && !sameValue(device.playback, DEFAULT_PREFERENCES.playback)) {
    upload.playback = device.playback;
  }

  return { toDevice, upload };
}
