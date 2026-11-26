import { ok } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { PasswordHasherPort } from '@vp/core/ports';
import { VIDEO_UNLOCK_TTL_SECONDS, type Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import type { UnlockCredentials } from '../video-access-gate';
import { VideoPasswordService } from '../video-password-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000002a1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000002a2', role: 'USER' };
const UNLISTED = '00000000-0000-7000-8000-0000000002a3';
const PUBLIC = '00000000-0000-7000-8000-0000000002a4';
const PRIVATE = '00000000-0000-7000-8000-0000000002a5';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const PASSWORD = 'open sesame';

const hasher: PasswordHasherPort = {
  hash: async (password) => ok(`salted:${[...password].reverse().join('')}`),
  verify: async (password, encoded) => ok(encoded === `salted:${[...password].reverse().join('')}`),
};

const unlock: UnlockCredentials = {
  issue: (videoId, _hash, expiresAtMs) => `${videoId}@${expiresAtMs}`,
  verify: () => true,
};

describe('apps/server/api/services: VideoPasswordService', () => {
  let repositories: InMemoryRepositories;
  let service: VideoPasswordService;

  const build = (credentials: UnlockCredentials | null) =>
    new VideoPasswordService({
      videos: repositories.videos,
      passwords: repositories.videoPasswords,
      hasher,
      unlock: credentials,
      now: () => NOW,
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = build(unlock);
    for (const [id, visibility] of [
      [UNLISTED, 'unlisted'],
      [PUBLIC, 'public'],
      [PRIVATE, 'private'],
    ] as const satisfies readonly (readonly [string, Video['visibility']])[]) {
      expectOk(
        await repositories.videos.create({
          id,
          ownerId: OWNER.id,
          channelId: await seedPrimaryChannel(repositories, OWNER.id),
          title: 'Guarded',
          visibility,
          status: 'READY',
          sourceKey: `raw/${id}.mp4`,
        })
      );
    }
  });

  it('keeps a salted hash, marks the video, and answers neither password nor hash', async () => {
    const set = expectOk(await service.set(OWNER, UNLISTED, PASSWORD));

    expect(set).toEqual({ passwordProtected: true });
    expect(expectOk(await repositories.videoPasswords.hashOf(UNLISTED))).toBe('salted:emases nepo');
    expect(expectOk(await repositories.videos.findById(UNLISTED))?.passwordProtected).toBe(true);
  });

  it.each([
    { scenario: 'a public video', videoId: PUBLIC, password: PASSWORD },
    { scenario: 'a password under four characters', videoId: UNLISTED, password: 'abc' },
  ])('refuses $scenario', async ({ videoId, password }) => {
    expect(expectErr(await service.set(OWNER, videoId, password)).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
  });

  it('refuses to set a password without VIDEO_ACCESS_SECRET, after the edit check', async () => {
    const off = build(null);

    expect(expectErr(await off.set(OWNER, UNLISTED, PASSWORD)).code).toBe(
      ErrorCodes.VIDEO_PASSWORDS_OFF
    );
    expect(expectErr(await off.set(STRANGER, PRIVATE, PASSWORD)).code).toBe(
      ErrorCodes.VIDEO_NOT_FOUND
    );
  });

  it('removes the password', async () => {
    expectOk(await service.set(OWNER, UNLISTED, PASSWORD));

    expect(expectOk(await service.clear(OWNER, UNLISTED))).toBeNull();
    expect(expectOk(await repositories.videoPasswords.hashOf(UNLISTED))).toBeNull();
  });

  it('unlocks with the right password for twelve hours', async () => {
    expectOk(await service.set(OWNER, UNLISTED, PASSWORD));

    expect(expectOk(await service.unlock(null, UNLISTED, PASSWORD))).toEqual({
      credential: `${UNLISTED}@${NOW + VIDEO_UNLOCK_TTL_SECONDS * 1000}`,
      maxAgeSeconds: VIDEO_UNLOCK_TTL_SECONDS,
    });
  });

  it.each([
    {
      scenario: 'a wrong password',
      videoId: UNLISTED,
      guarded: true,
      code: ErrorCodes.VIDEO_PASSWORD_INVALID,
    },
    {
      scenario: 'a video without one',
      videoId: UNLISTED,
      guarded: false,
      code: ErrorCodes.VIDEO_PASSWORD_INVALID,
    },
    {
      scenario: 'a private video',
      videoId: PRIVATE,
      guarded: false,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
  ])('refuses to unlock $scenario with $code', async ({ videoId, guarded, code }) => {
    if (guarded) expectOk(await service.set(OWNER, videoId, PASSWORD));

    expect(expectErr(await service.unlock(null, videoId, 'guess')).code).toBe(code);
  });

  it('refuses to unlock without VIDEO_ACCESS_SECRET', async () => {
    expect(expectErr(await build(null).unlock(null, UNLISTED, PASSWORD)).code).toBe(
      ErrorCodes.VIDEO_PASSWORDS_OFF
    );
  });

  it.each([
    { action: 'set', run: (s: VideoPasswordService) => s.set(STRANGER, UNLISTED, PASSWORD) },
    { action: 'clear', run: (s: VideoPasswordService) => s.clear(STRANGER, UNLISTED) },
  ])(
    'refuses a stranger who would $action with a 403 on a video they can watch',
    async ({ run }) => {
      expect(expectErr(await run(service)).code).toBe(ErrorCodes.FORBIDDEN);
    }
  );
});
