import {
  DEFAULT_PREFERENCES,
  type PreferencesPatch,
  type UserPreferences,
} from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { decidePreferencesUpdate, type UpdatePreferencesInput } from '../update-preferences.rule';

const STORED: UserPreferences = {
  userId: 'user-1',
  appearance: DEFAULT_PREFERENCES.appearance,
  playback: null,
  privacy: null,
  notifications: null,
  version: 3,
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
};

const MAX_TOKEN_OVERRIDES = 16;

const groups = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`group${index}`, 'compact']));

const decide = (input: Partial<UpdatePreferencesInput> = {}) =>
  decidePreferencesUpdate({
    userId: 'user-1',
    current: STORED,
    version: 3,
    patch: { privacy: { historyPaused: true } },
    ...input,
  });

describe('@vp/domain-rules: decidePreferencesUpdate', () => {
  it.each<{ scenario: string; current: UserPreferences | null; version: number }>([
    { scenario: 'the stored version', current: STORED, version: 3 },
    { scenario: 'version 0 on an account with nothing stored', current: null, version: 0 },
  ])('merges a patch based on $scenario', ({ current, version }) => {
    expect(expectOk(decide({ current, version })).privacy?.historyPaused).toBe(true);
  });

  it.each<{ scenario: string; current: UserPreferences | null; version: number }>([
    { scenario: 'an older version', current: STORED, version: 2 },
    { scenario: 'version 0 once something is stored', current: STORED, version: 0 },
    { scenario: 'a version on an account with nothing stored', current: null, version: 1 },
  ])('refuses $scenario as a conflict carrying what is stored', ({ current, version }) => {
    expect(expectErr(decide({ current, version }))).toMatchObject({
      code: ErrorCodes.VERSION_CONFLICT,
      current,
    });
  });

  it.each<{ field: string; patch: PreferencesPatch; current?: UserPreferences }>([
    { field: 'appearance.theme', patch: { appearance: { theme: 'Sand' } } },
    { field: 'appearance.accent', patch: { appearance: { accent: 'red' } } },
    {
      field: 'appearance.overrides',
      patch: { appearance: { overrides: { extra: 'x' } } },
      current: {
        ...STORED,
        appearance: { ...DEFAULT_PREFERENCES.appearance, overrides: groups(MAX_TOKEN_OVERRIDES) },
      },
    },
    { field: 'playback.captionsLanguage', patch: { playback: { captionsLanguage: 'english!' } } },
  ])(
    'refuses a value $field does not accept, the cap counted after the merge',
    ({ field, patch, current }) => {
      expect(expectErr(decide({ patch, current: current ?? STORED }))).toMatchObject({
        code: ErrorCodes.VALIDATION_FAILED,
        field,
      });
    }
  );

  it('stores an unknown theme or set id of the right shape as sent', () => {
    const patch = {
      appearance: { theme: 'not-in-any-registry', overrides: { fontSize: 'unheard-of' } },
    };

    expect(expectOk(decide({ patch })).appearance).toMatchObject(patch.appearance);
  });
});
