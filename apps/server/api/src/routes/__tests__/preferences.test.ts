import { mintToken } from '@vp/dev-token';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { bearer, buildTestApp, type TestApp } from '../../__tests__/test-app';

const SESSION = {
  laptop: bearer(mintToken({ sub: SEEDED.userId, role: 'user', ttl: '1h' })),
  phone: bearer(mintToken({ sub: SEEDED.userId, role: 'user', ttl: '1h' })),
  guest: bearer(mintToken({ sub: SEEDED.otherUserId, role: 'guest', ttl: '1h' })),
  anonymous: {},
};

type Session = keyof typeof SESSION;

describe('preferences routes', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await buildTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const read = (session: Session = 'phone') =>
    ctx.app.inject({ method: 'GET', url: '/v1/me/preferences', headers: SESSION[session] });

  const save = (payload: Record<string, unknown>, session: Session = 'laptop') =>
    ctx.app.inject({
      method: 'PATCH',
      url: '/v1/me/preferences',
      headers: SESSION[session],
      payload,
    });

  it('answers an account that never saved with every section null at version 0', async () => {
    expect((await read()).json()).toEqual({
      appearance: null,
      playback: null,
      privacy: null,
      notifications: null,
      version: 0,
      updatedAt: null,
    });
  });

  it('returns a spacing override saved on one session to the next read on another, one version on', async () => {
    const saved = await save({ version: 0, appearance: { overrides: { spacing: 'compact' } } });
    expect(saved.statusCode).toBe(200);
    expect(
      (await save({ version: 1, appearance: { theme: 'not-in-any-registry' } })).statusCode
    ).toBe(200);

    const res = await read('phone');

    expect(res.json()).toMatchObject({
      appearance: {
        ...DEFAULT_PREFERENCES.appearance,
        theme: 'not-in-any-registry',
        overrides: { spacing: 'compact' },
      },
      playback: null,
      version: 2,
    });
  });

  it('leaves out sections the patch leaves out and resets a null field to its default', async () => {
    await save({ version: 0, playback: { speed: 1.5 }, privacy: { historyPaused: true } });

    const res = await save({ version: 1, privacy: { historyPaused: null } });

    expect(res.json()).toMatchObject({
      playback: { speed: 1.5 },
      privacy: DEFAULT_PREFERENCES.privacy,
      version: 2,
    });
  });

  it('refuses a stale version with the stored document in the conflict and writes nothing', async () => {
    const stored = (await save({ version: 0, playback: { speed: 2 } })).json();

    const res = await save({ version: 0, playback: { speed: 0.5 } }, 'phone');

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code: ErrorCodes.VERSION_CONFLICT,
      errors: [{ field: 'version', current: stored }],
    });
    expect((await read()).json()).toEqual(stored);
  });

  it.each([
    { scenario: 'a theme id out of shape', body: { appearance: { theme: 'Sand' } }, status: 422 },
    {
      scenario: 'a mode out of the vocabulary',
      body: { appearance: { mode: 'dim' } },
      status: 400,
    },
  ])('refuses $scenario with $status', async ({ body, status }) => {
    const res = await save({ version: 0, ...body });

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it.each([
    { session: 'anonymous' as const, status: 401, code: ErrorCodes.UNAUTHORIZED },
    { session: 'guest' as const, status: 403, code: ErrorCodes.FORBIDDEN },
  ])('refuses a $session caller both ways with $status', async ({ session, status, code }) => {
    for (const res of [await read(session), await save({ version: 0 }, session)]) {
      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    }
  });
});
