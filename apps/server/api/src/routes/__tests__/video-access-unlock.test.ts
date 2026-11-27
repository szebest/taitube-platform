import { createLogger } from '@kit/logger';
import { captureLog } from '@kit/testing/log-capture';
import { expectOk } from '@kit/testing/result';
import { videoAccessCookieName } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-identity';
import { VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE, VIDEO_UNLOCK_TTL_SECONDS } from '@vp/domain';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { type TestApp, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const OWNER = '11111111-1111-7111-8111-1111111111b1';
const GUARDED = '66666666-6666-7666-8666-6666666666b6';
const NEIGHBOUR = '77777777-7777-7777-8777-7777777777b7';
const PASSWORD = 'correct horse battery';
const OWNER_HEADERS = bearer(mintToken({ sub: OWNER, role: 'CREATOR', ttl: '1h' }));
const COOKIE = videoAccessCookieName(GUARDED);

describe('video unlock route', () => {
  let ctx: TestApp;
  let log: ReturnType<typeof captureLog>;

  const setPassword = (password: string) =>
    ctx.app.inject({
      method: 'PUT',
      url: `/v1/creator/videos/${GUARDED}/password`,
      headers: OWNER_HEADERS,
      payload: { password },
    });
  const unlock = (password: string, headers: Record<string, string> = {}, videoId = GUARDED) =>
    ctx.app.inject({
      method: 'POST',
      url: `/v1/videos/${videoId}/unlock`,
      headers,
      payload: { password },
    });
  const credentialOf = (setCookie: unknown) =>
    /^vp\.video-access\.[\w-]+=([^;]+)/.exec(String(setCookie))?.[1] ?? '';
  const watch = (credential?: string) =>
    ctx.app.inject({
      method: 'GET',
      url: `/v1/videos/${GUARDED}`,
      headers: credential ? { cookie: `${COOKIE}=${credential}` } : {},
    });

  beforeEach(async () => {
    log = captureLog();
    ctx = await buildTestApp({
      config: inProcessAppConfig({ http: { trustProxy: ['127.0.0.1'] } }),
      logger: createLogger({
        format: 'json',
        service: 'vp-api',
        level: 'trace',
        destination: log.destination,
      }),
    });
    for (const id of [GUARDED, NEIGHBOUR]) {
      await seedVideo(ctx.repositories, {
        id,
        ownerId: OWNER,
        title: 'Guarded',
        visibility: 'unlisted',
      });
    }
    expectOk(await ctx.repositories.videoPasswords.setHash(NEIGHBOUR, 'unused'));
    expect((await setPassword(PASSWORD)).statusCode).toBe(200);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('sets a 12-hour httpOnly cookie for the video that lifts the gate', async () => {
    const res = await unlock(PASSWORD);

    expect([res.statusCode, res.body]).toEqual([204, '']);
    expect(String(res.headers['set-cookie'])).toBe(
      `${COOKIE}=${credentialOf(res.headers['set-cookie'])}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VIDEO_UNLOCK_TTL_SECONDS}`
    );
    expect((await watch()).statusCode).toBe(403);
    expect((await watch(credentialOf(res.headers['set-cookie']))).statusCode).toBe(200);
  });

  it('marks the cookie Secure when the request came over https', async () => {
    const res = await unlock(PASSWORD, { 'x-forwarded-proto': 'https' });

    expect(String(res.headers['set-cookie'])).toMatch(/; Secure$/);
  });

  it('ends every unlock made under the old password once a new one is set', async () => {
    const credential = credentialOf((await unlock(PASSWORD)).headers['set-cookie']);

    await setPassword('a brand new password');

    expect([(await watch(credential)).statusCode, (await watch(credential)).json().code]).toEqual([
      403,
      ErrorCodes.VIDEO_PASSWORD_REQUIRED,
    ]);
  });

  it('answers a wrong password with 403 and the sixth attempt in a minute with 429, per video in any casing', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE; attempt += 1) {
      const id = attempt % 2 === 0 ? GUARDED : GUARDED.toUpperCase();
      statuses.push((await unlock('a guess', {}, id)).statusCode);
    }
    const neighbour = await unlock('a guess', {}, NEIGHBOUR);

    expect(statuses).toEqual([403, 403, 403, 403, 403, 429]);
    expect(neighbour.json().code).toBe(ErrorCodes.VIDEO_PASSWORD_INVALID);
  });

  it('keeps a separate budget for each client the trusted proxy forwards', async () => {
    const from = (client: string) => ({ 'x-forwarded-for': client });
    for (let attempt = 0; attempt < VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE; attempt += 1) {
      await unlock('a guess', from('203.0.113.7'));
    }

    expect([
      (await unlock('a guess', from('203.0.113.7'))).statusCode,
      (await unlock('a guess', from('198.51.100.4'))).statusCode,
    ]).toEqual([429, 403]);
  });

  it('keeps the password and its hash out of every response and every log line', async () => {
    const hash = expectOk(await ctx.repositories.videoPasswords.hashOf(GUARDED)) ?? 'missing';
    const responses = [
      await setPassword(PASSWORD),
      await unlock('a guess'),
      await unlock(PASSWORD),
      await watch(),
      await ctx.app.inject({ method: 'GET', url: `/v1/videos/${GUARDED}`, headers: OWNER_HEADERS }),
    ];

    for (const secret of [PASSWORD, hash]) {
      expect(
        responses.map((res) => `${JSON.stringify(res.headers)}${res.body}`).join('')
      ).not.toContain(secret);
      expect(log.text()).not.toContain(secret);
    }
    expect(log.lines().length).toBeGreaterThan(0);
  });

  it('answers 409 VIDEO_PASSWORDS_OFF on a server without VIDEO_ACCESS_SECRET', async () => {
    const config = inProcessAppConfig();
    const off = await buildTestApp({
      config: { ...config, videoAccess: { secret: undefined } },
      adapters: { repositories: ctx.repositories },
    });

    const res = await off.app.inject({
      method: 'POST',
      url: `/v1/videos/${GUARDED}/unlock`,
      payload: { password: PASSWORD },
    });
    await off.app.close();

    expect([res.statusCode, res.json().code]).toEqual([409, ErrorCodes.VIDEO_PASSWORDS_OFF]);
  });
});
