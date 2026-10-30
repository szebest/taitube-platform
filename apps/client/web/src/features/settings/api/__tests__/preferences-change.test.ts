import type { PreferencesView } from '@vp/api-contracts';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';

import { applyChange, changedPaths, mergeChanges } from '../preferences-change';

const view = (overrides: Partial<PreferencesView> = {}): PreferencesView => ({
  appearance: null,
  playback: null,
  privacy: null,
  notifications: null,
  version: 3,
  updatedAt: null,
  ...overrides,
});

describe('mergeChanges', () => {
  it('merges fields, and overrides by token group', () => {
    expect(
      mergeChanges(
        { appearance: { mode: 'dark', overrides: { radius: 'sharp' } }, playback: { speed: 2 } },
        { appearance: { overrides: { spacing: 'airy' } }, privacy: { historyPaused: true } }
      )
    ).toEqual({
      appearance: { mode: 'dark', overrides: { radius: 'sharp', spacing: 'airy' } },
      playback: { speed: 2 },
      privacy: { historyPaused: true },
    });
  });
});

describe('applyChange', () => {
  it('fills a never-saved section from its defaults, then the change', () => {
    expect(applyChange(view(), { playback: { speed: 2 } }).playback).toEqual({
      ...DEFAULT_PREFERENCES.playback,
      speed: 2,
    });
  });

  it('resets a field set to null, and drops an override set to null', () => {
    const stored = view({
      appearance: {
        ...DEFAULT_PREFERENCES.appearance,
        mode: 'oled',
        overrides: { radius: 'sharp', spacing: 'airy' },
      },
    });

    expect(
      applyChange(stored, { appearance: { mode: null, overrides: { radius: null } } }).appearance
    ).toEqual({
      ...DEFAULT_PREFERENCES.appearance,
      mode: 'system',
      overrides: { spacing: 'airy' },
    });
  });

  it('keeps the version and the sections the change leaves out', () => {
    const stored = view({ privacy: { ...DEFAULT_PREFERENCES.privacy, historyPaused: true } });

    expect(applyChange(stored, { playback: { speed: 2 } })).toMatchObject({
      version: 3,
      privacy: { historyPaused: true },
    });
  });
});

describe('changedPaths', () => {
  it('names each field, and each overridden token group', () => {
    expect(
      changedPaths({
        appearance: { mode: 'dark', overrides: { radius: 'sharp', spacing: null } },
        playback: { speed: 2 },
      })
    ).toEqual([
      'appearance.mode',
      'appearance.overrides.radius',
      'appearance.overrides.spacing',
      'playback.speed',
    ]);
  });
});
