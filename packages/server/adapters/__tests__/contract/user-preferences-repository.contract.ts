import type { SavePreferencesOptions, UserPreferencesRepositoryPort } from '@vp/core/repositories';
import { DEFAULT_PREFERENCES, type Preferences } from '@vp/domain/settings';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const PREFERENCES: Preferences = {
  appearance: {
    ...DEFAULT_PREFERENCES.appearance,
    theme: 'nocturne',
    overrides: { fontSize: 'large' },
  },
  playback: { ...DEFAULT_PREFERENCES.playback, speed: 1.5, autoplayNext: false },
  privacy: { ...DEFAULT_PREFERENCES.privacy, historyPaused: true },
  notifications: null,
};

export function describeUserPreferencesRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('UserPreferencesRepository contract', () => {
    let subject: RepositoriesSubject;
    let preferences: UserPreferencesRepositoryPort;

    const save = async (options: Partial<SavePreferencesOptions> = {}) =>
      expectOk(
        await preferences.save({
          userId: OWNER_ID,
          preferences: PREFERENCES,
          expectedVersion: 0,
          ...options,
        })
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      preferences = subject.repositories.userPreferences;
    });

    it('finds nothing for an account that never saved', async () => {
      expect(expectOk(await preferences.find(OWNER_ID))).toBeNull();
    });

    it('stores the first save at version 1 and finds it again', async () => {
      const saved = await save();

      expect(saved).toMatchObject({ userId: OWNER_ID, ...PREFERENCES, version: 1 });
      expect(expectOk(await preferences.find(OWNER_ID))).toEqual(saved);
      expect(expectOk(await preferences.find(OTHER_OWNER_ID))).toBeNull();
    });

    it('replaces the sections and bumps the version on a save based on the stored one', async () => {
      await save();

      const saved = await save({
        preferences: { ...PREFERENCES, privacy: null },
        expectedVersion: 1,
      });

      expect(saved).toMatchObject({ privacy: null, version: 2 });
    });

    it.each([
      { scenario: 'a first save once one landed', expectedVersion: 0 },
      { scenario: 'a save based on an older version', expectedVersion: 7 },
    ])('writes nothing for $scenario', async ({ expectedVersion }) => {
      const stored = await save();

      expect(
        await save({ preferences: { ...PREFERENCES, privacy: null }, expectedVersion })
      ).toBeNull();
      expect(expectOk(await preferences.find(OWNER_ID))).toEqual(stored);
    });

    it('writes nothing for a version on an account that never saved', async () => {
      expect(await save({ expectedVersion: 3 })).toBeNull();
      expect(expectOk(await preferences.find(OWNER_ID))).toBeNull();
    });
  });
}
