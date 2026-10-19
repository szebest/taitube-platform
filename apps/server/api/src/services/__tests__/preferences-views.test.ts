import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { toPreferencesView } from '../preferences-views';

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
  ])('answers $scenario', ({ stored, view }) => {
    expect(toPreferencesView(stored)).toEqual(view);
  });
});
