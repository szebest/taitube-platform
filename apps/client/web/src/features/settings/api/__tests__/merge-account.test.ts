import type { PreferencesView } from '@vp/api-contracts';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';

import { planMerge } from '../merge-account';

const DEVICE = {
  appearance: { ...DEFAULT_PREFERENCES.appearance, mode: 'oled', overrides: { spacing: 'airy' } },
  playback: { ...DEFAULT_PREFERENCES.playback, speed: 1.5 },
} as const;

const DEFAULT_DEVICE = {
  appearance: DEFAULT_PREFERENCES.appearance,
  playback: DEFAULT_PREFERENCES.playback,
} as const;

const SAVED_PLAYBACK = { ...DEFAULT_PREFERENCES.playback, autoplayNext: false };

const account = (overrides: Partial<PreferencesView> = {}): PreferencesView => ({
  appearance: null,
  playback: null,
  privacy: null,
  notifications: null,
  version: 0,
  updatedAt: null,
  ...overrides,
});

describe('planMerge', () => {
  it.each([
    {
      label: 'takes a saved section over the device and uploads the other',
      saved: account({ playback: SAVED_PLAYBACK }),
      device: DEVICE,
      firstMerge: true,
      expected: {
        toDevice: { playback: SAVED_PLAYBACK },
        upload: { appearance: DEVICE.appearance },
      },
    },
    {
      label: 'uploads both sections of a never-saved account',
      saved: account(),
      device: DEVICE,
      firstMerge: true,
      expected: { toDevice: {}, upload: DEVICE },
    },
    {
      label: 'uploads nothing a device holds only defaults for',
      saved: account(),
      device: DEFAULT_DEVICE,
      firstMerge: true,
      expected: { toDevice: {}, upload: {} },
    },
    {
      label: 'uploads nothing after the first merge',
      saved: account({ version: 2 }),
      device: DEVICE,
      firstMerge: false,
      expected: { toDevice: {}, upload: {} },
    },
  ])('$label', ({ saved, device, firstMerge, expected }) => {
    expect(planMerge(saved, device, firstMerge)).toEqual(expected);
  });
});
