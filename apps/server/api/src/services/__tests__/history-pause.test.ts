import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { HistoryPause } from '../history-pause';

const VIEWER = { id: '00000000-0000-7000-8000-00000000d001', role: 'USER' } as const;

describe('apps/server/api/services: HistoryPause', () => {
  let repositories: InMemoryRepositories;
  let pause: HistoryPause;

  const save = async (historyPaused: boolean) =>
    expectOk(
      await repositories.userPreferences.save({
        userId: VIEWER.id,
        preferences: {
          appearance: null,
          playback: null,
          privacy: { ...DEFAULT_PREFERENCES.privacy, historyPaused },
          notifications: null,
        },
        expectedVersion: 0,
        sections: ['privacy'],
      })
    );

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    pause = new HistoryPause(repositories.userPreferences);
  });

  it('is not paused for a viewer who never saved a preference', async () => {
    expect(expectOk(await pause.isPaused(VIEWER.id))).toBe(false);
  });

  it.each([true, false])('answers the saved switch (%s)', async (historyPaused) => {
    await save(historyPaused);

    expect(expectOk(await pause.isPaused(VIEWER.id))).toBe(historyPaused);
  });

  it('passes a failed read on', async () => {
    const failure = databaseUnavailable.during('findPreferences')(new Error('down'));
    vi.spyOn(repositories.userPreferences, 'find').mockResolvedValueOnce(err(failure));

    expect(expectErr(await pause.isPaused(VIEWER.id))).toBe(failure);
  });
});
