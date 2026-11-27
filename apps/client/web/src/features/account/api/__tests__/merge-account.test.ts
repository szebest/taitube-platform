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

const NONE: ReadonlySet<string> = new Set();

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
      label:
        'takes a saved section over the device and uploads the fields of the other that differ',
      saved: account({ playback: SAVED_PLAYBACK }),
      device: DEVICE,
      dirty: NONE,
      firstMerge: true,
      expected: {
        toDevice: { playback: { ...SAVED_PLAYBACK, speed: 1 } },
        upload: { appearance: { mode: 'oled', overrides: { spacing: 'airy' } } },
        conflicts: [],
      },
    },
    {
      label: 'uploads the changed fields of a never-saved account, and not the defaults',
      saved: account(),
      device: DEVICE,
      dirty: NONE,
      firstMerge: true,
      expected: {
        toDevice: {},
        upload: {
          appearance: { mode: 'oled', overrides: { spacing: 'airy' } },
          playback: { speed: 1.5 },
        },
        conflicts: [],
      },
    },
    {
      label: 'uploads nothing a device holds only defaults for',
      saved: account(),
      device: DEFAULT_DEVICE,
      dirty: NONE,
      firstMerge: true,
      expected: { toDevice: {}, upload: {}, conflicts: [] },
    },
    {
      label: 'uploads nothing after the first merge unless a field was chosen here',
      saved: account({ version: 2 }),
      device: DEVICE,
      dirty: NONE,
      firstMerge: false,
      expected: { toDevice: {}, upload: {}, conflicts: [] },
    },
    {
      label: 'uploads a field chosen here even after the first merge',
      saved: account({ version: 2 }),
      device: DEVICE,
      dirty: new Set(['playback.speed']),
      firstMerge: false,
      expected: { toDevice: {}, upload: { playback: { speed: 1.5 } }, conflicts: [] },
    },
    {
      label: 'takes the account value of every field not chosen here, one by one',
      saved: account({
        playback: { ...DEFAULT_PREFERENCES.playback, speed: 2, autoplayNext: false },
      }),
      device: DEVICE,
      dirty: new Set(['playback.speed']),
      firstMerge: true,
      expected: {
        toDevice: {
          playback: { ...DEFAULT_PREFERENCES.playback, speed: 1.5, autoplayNext: false },
        },
        upload: {
          appearance: { mode: 'oled', overrides: { spacing: 'airy' } },
          playback: { speed: 1.5 },
        },
        conflicts: [{ path: 'playback.speed', account: 2 }],
      },
    },
    {
      label: 'does not raise a conflict for a field chosen here that the account already holds',
      saved: account({ playback: { ...DEFAULT_PREFERENCES.playback, speed: 1.5 } }),
      device: DEVICE,
      dirty: new Set(['playback.speed']),
      firstMerge: false,
      expected: { toDevice: {}, upload: {}, conflicts: [] },
    },
    {
      label: 'merges the token overrides group by group',
      saved: account({
        appearance: {
          ...DEFAULT_PREFERENCES.appearance,
          overrides: { spacing: 'compact', radius: 'soft' },
        },
      }),
      device: DEVICE,
      dirty: new Set(['appearance.overrides.spacing']),
      firstMerge: false,
      expected: {
        toDevice: {
          appearance: {
            ...DEVICE.appearance,
            mode: 'system',
            overrides: { spacing: 'airy', radius: 'soft' },
          },
        },
        upload: { appearance: { overrides: { spacing: 'airy' } } },
        conflicts: [{ path: 'appearance.overrides.spacing', account: 'compact' }],
      },
    },
    {
      label: 'clears an override on the account the viewer cleared here',
      saved: account({
        appearance: { ...DEFAULT_PREFERENCES.appearance, overrides: { radius: 'soft' } },
      }),
      device: DEFAULT_DEVICE,
      dirty: new Set(['appearance.overrides.radius']),
      firstMerge: false,
      expected: {
        toDevice: {},
        upload: { appearance: { overrides: { radius: null } } },
        conflicts: [{ path: 'appearance.overrides.radius', account: 'soft' }],
      },
    },
  ])('$label', ({ saved, device, dirty, firstMerge, expected }) => {
    expect(planMerge(saved, device, dirty, firstMerge)).toEqual(expected);
  });
});
