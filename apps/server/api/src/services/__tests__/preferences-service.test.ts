import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { PreferencesService } from '../preferences-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000e001', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000e002', role: 'USER' };

describe('PreferencesService', () => {
  let repositories: InMemoryRepositories;
  let service: PreferencesService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new PreferencesService({ preferences: repositories.userPreferences });
  });

  it.each([
    { action: 'read', call: () => service.get(STRANGER, OWNER.id) },
    { action: 'update', call: () => service.update(STRANGER, OWNER.id, { version: 0 }) },
  ])('refuses to $action the preferences of another account', async ({ call }) => {
    expect(expectErr(await call()).code).toBe(ErrorCodes.FORBIDDEN);
    expect(expectOk(await repositories.userPreferences.find(OWNER.id))).toBeNull();
  });

  it('answers a save that lost a race with a conflict carrying the winner', async () => {
    const winner = {
      appearance: null,
      playback: DEFAULT_PREFERENCES.playback,
      privacy: null,
      notifications: null,
    };
    vi.spyOn(repositories.userPreferences, 'save').mockImplementationOnce(async () => {
      await repositories.userPreferences.save({
        userId: OWNER.id,
        preferences: winner,
        expectedVersion: 0,
        sections: ['playback'],
      });
      return ok(null);
    });

    const failure = expectErr(
      await service.update(OWNER, OWNER.id, { version: 0, privacy: { historyPaused: true } })
    );

    expect(failure).toMatchObject({
      code: ErrorCodes.VERSION_CONFLICT,
      current: { ...winner, version: 1 },
    });
  });

  it('announces the sections the patch named and the version it saved to the owner', async () => {
    expectOk(
      await service.update(OWNER, OWNER.id, {
        version: 0,
        playback: { speed: 1.5 },
        privacy: null,
      })
    );

    const [event] = expectOk(await repositories.userEvents.listFrom(OWNER.id, 0, 10));
    expect(event).toMatchObject({
      type: 'preferences.updated',
      payload: { sections: ['playback', 'privacy'], version: 1 },
    });
  });
});
