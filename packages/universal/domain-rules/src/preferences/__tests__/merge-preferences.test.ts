import {
  type AppearancePreferences,
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesPatch,
} from '@vp/domain/settings';
import { mergePreferences } from '../merge-preferences';

const APPEARANCE: AppearancePreferences = {
  ...DEFAULT_PREFERENCES.appearance,
  theme: 'nocturne',
  mode: 'dark',
  overrides: { spacing: 'compact', radius: 'round' },
};

const STORED: Preferences = {
  appearance: APPEARANCE,
  playback: { ...DEFAULT_PREFERENCES.playback, speed: 1.5, autoplayNext: false },
  privacy: { ...DEFAULT_PREFERENCES.privacy, historyPaused: true },
  notifications: { ...DEFAULT_PREFERENCES.notifications, processingFinished: false },
};

const NOTHING: Preferences = {
  appearance: null,
  playback: null,
  privacy: null,
  notifications: null,
};

describe('@vp/domain-rules: mergePreferences', () => {
  it.each<{ section: keyof Preferences; patch: PreferencesPatch; filled: object }>([
    {
      section: 'appearance',
      patch: { appearance: { overrides: { spacing: 'compact' } } },
      filled: { overrides: { spacing: 'compact' } },
    },
    { section: 'playback', patch: { playback: { speed: 2 } }, filled: { speed: 2 } },
    {
      section: 'privacy',
      patch: { privacy: { historyPaused: true } },
      filled: { historyPaused: true },
    },
    {
      section: 'notifications',
      patch: { notifications: { subscriptionUploads: false } },
      filled: { subscriptionUploads: false },
    },
  ])(
    'fills the rest of $section from its defaults on its first save',
    ({ section, patch, filled }) => {
      expect(mergePreferences(NOTHING, patch)).toEqual({
        ...NOTHING,
        [section]: { ...DEFAULT_PREFERENCES[section], ...filled },
      });
    }
  );

  it.each<{ section: keyof Preferences; patch: PreferencesPatch; reset: object }>([
    {
      section: 'appearance',
      patch: { appearance: { mode: null } },
      reset: { mode: DEFAULT_PREFERENCES.appearance.mode },
    },
    {
      section: 'playback',
      patch: { playback: { speed: null } },
      reset: { speed: DEFAULT_PREFERENCES.playback.speed },
    },
    {
      section: 'privacy',
      patch: { privacy: { historyPaused: null } },
      reset: { historyPaused: DEFAULT_PREFERENCES.privacy.historyPaused },
    },
    {
      section: 'notifications',
      patch: { notifications: { processingFinished: null } },
      reset: { processingFinished: DEFAULT_PREFERENCES.notifications.processingFinished },
    },
  ])(
    'resets a null field of $section to its default and keeps its siblings',
    ({ section, patch, reset }) => {
      expect(mergePreferences(STORED, patch)).toEqual({
        ...STORED,
        [section]: { ...STORED[section], ...reset },
      });
    }
  );

  it.each<{ scenario: string; patch: PreferencesPatch; expected: Preferences }>([
    { scenario: 'an empty patch leaves everything', patch: {}, expected: STORED },
    {
      scenario: 'a null section clears it',
      patch: { privacy: null },
      expected: { ...STORED, privacy: null },
    },
    {
      scenario: 'overrides merge by token group, and a null group drops',
      patch: { appearance: { overrides: { spacing: 'roomy', radius: null, fontSize: 'large' } } },
      expected: {
        ...STORED,
        appearance: { ...APPEARANCE, overrides: { spacing: 'roomy', fontSize: 'large' } },
      },
    },
  ])('$scenario', ({ patch, expected }) => {
    expect(mergePreferences(STORED, patch)).toEqual(expected);
  });
});
