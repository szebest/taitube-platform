import { type AppearancePreferences, DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { toPreferencesView } from '../preferences-views';

const { customGround: _ground, customAccent: _accent, ...legacy } = DEFAULT_PREFERENCES.appearance;

describe('toPreferencesView', () => {
  it.each([
    {
      scenario: 'nothing stored',
      stored: null,
      view: {
        appearance: null,
        playback: null,
        privacy: null,
        notifications: null,
        version: 0,
        updatedAt: null,
      },
    },
    {
      scenario: 'a stored document',
      stored: {
        userId: 'user-1',
        ...DEFAULT_PREFERENCES,
        version: 4,
        updatedAt: new Date('2026-10-19T08:00:00.000Z'),
      },
      view: { ...DEFAULT_PREFERENCES, version: 4, updatedAt: '2026-10-19T08:00:00.000Z' },
    },
    {
      scenario: 'an appearance saved before the custom theme fields',
      stored: {
        userId: 'user-1',
        ...DEFAULT_PREFERENCES,
        appearance: { ...legacy, mode: 'dark' } as AppearancePreferences,
        version: 2,
        updatedAt: new Date('2026-10-19T08:00:00.000Z'),
      },
      view: {
        ...DEFAULT_PREFERENCES,
        appearance: { ...DEFAULT_PREFERENCES.appearance, mode: 'dark' },
        version: 2,
        updatedAt: '2026-10-19T08:00:00.000Z',
      },
    },
  ])('answers $scenario', ({ stored, view }) => {
    expect(toPreferencesView(stored)).toEqual(view);
  });
});
