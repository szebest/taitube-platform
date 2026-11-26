import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { Video } from '@vp/domain';
import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { NO_VIDEO_ACCESS, type VideoAccess, VideoAccessGate } from '../video-access-gate';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000c1', role: 'CREATOR' };
const VIDEO = '00000000-0000-7000-8000-0000000000c2';
const OTHER = '00000000-0000-7000-8000-0000000000c3';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const TOKEN = 'tokentokentokentoken01';
const HASH = 'scrypt$hash';

describe('apps/server/api/services: VideoAccessGate', () => {
  let repositories: InMemoryRepositories;
  let gate: VideoAccessGate;

  const seed = async (visibility: Video['visibility'], id = VIDEO) =>
    expectOk(
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        title: 'Seen',
        visibility,
        status: 'READY',
        sourceKey: `raw/${id}.mp4`,
      })
    );
  const link = async (overrides: { targetId?: string; expiresAt?: Date | null } = {}) => {
    expectOk(
      await repositories.shareLinks.create(
        {
          id: '00000000-0000-7000-8000-0000000000c9',
          targetType: 'video',
          targetId: VIDEO,
          token: TOKEN,
          label: null,
          expiresAt: null,
          createdBy: OWNER.id,
          revokedAt: null,
          createdAt: new Date(NOW - 1000),
          ...overrides,
        },
        50
      )
    );
  };
  const read = async (access: Partial<VideoAccess>, viewer: UserContext | null = null) =>
    gate.read(viewer, expectOk(await repositories.videos.findById(VIDEO)), VIDEO, {
      ...NO_VIDEO_ACCESS,
      ...access,
    });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    gate = new VideoAccessGate({
      shareLinks: repositories.shareLinks,
      passwords: repositories.videoPasswords,
      unlock: {
        issue: () => 'unlocked',
        verify: (_id, hash, credential) => hash === HASH && credential === 'unlocked',
      },
      now: () => NOW,
    });
  });

  it('lets a live link of the video read it whatever its visibility, and names the link', async () => {
    await seed('private');
    await link();

    expect(expectOk(await read({ shareToken: TOKEN })).link?.id).toBe(
      '00000000-0000-7000-8000-0000000000c9'
    );
  });

  it.each([
    { scenario: 'expired', overrides: { expiresAt: new Date(NOW - 1) } },
    { scenario: 'revoked', overrides: {}, revoke: true },
  ])(
    'answers a dead link of the video, $scenario, with SHARE_LINK_EXPIRED',
    async ({ overrides, revoke }) => {
      await seed('public');
      await link(overrides);
      if (revoke)
        await repositories.shareLinks.revoke(
          'video',
          VIDEO,
          '00000000-0000-7000-8000-0000000000c9',
          new Date(NOW - 1)
        );

      expect(expectErr(await read({ shareToken: TOKEN })).code).toBe(ErrorCodes.SHARE_LINK_EXPIRED);
    }
  );

  it.each([
    { scenario: 'a link of another video', targetId: OTHER },
    { scenario: 'a token nobody made', targetId: null },
  ])('proves nothing with $scenario', async ({ targetId }) => {
    await seed('private');
    await seed('private', OTHER);
    if (targetId) await link({ targetId });

    expect(expectErr(await read({ shareToken: TOKEN }))).toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
    });
  });

  it('answers a missing video as missing, not as its dead link', async () => {
    await link({ expiresAt: new Date(NOW - 1) });

    expect(
      expectErr(await gate.read(null, null, VIDEO, { ...NO_VIDEO_ACCESS, shareToken: TOKEN })).code
    ).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  describe('a password-protected unlisted video', () => {
    beforeEach(async () => {
      await seed('unlisted');
      expectOk(await repositories.videoPasswords.setHash(VIDEO, HASH));
    });

    it.each([
      { scenario: 'nothing', access: {}, viewer: null, passes: false },
      {
        scenario: 'a credential for another password',
        access: { credential: 'stale' },
        viewer: null,
        passes: false,
      },
      {
        scenario: 'its unlock credential',
        access: { credential: 'unlocked' },
        viewer: null,
        passes: true,
      },
      { scenario: 'its owner', access: {}, viewer: OWNER, passes: true },
    ])('lets $scenario through: $passes', async ({ access, viewer, passes }) => {
      const gated = await read(access, viewer);

      expect(gated.ok ? null : gated.error.code).toBe(
        passes ? null : ErrorCodes.VIDEO_PASSWORD_REQUIRED
      );
    });

    it('lets a live link through without the password', async () => {
      await link();

      expect((await read({ shareToken: TOKEN })).ok).toBe(true);
    });

    it('passes the store failure on when the hash cannot be read', async () => {
      vi.spyOn(repositories.videoPasswords, 'hashOf').mockResolvedValueOnce(
        err(databaseUnavailable('hashOf'))
      );

      expect(expectErr(await read({ credential: 'unlocked' })).code).toBe(
        ErrorCodes.DATABASE_UNAVAILABLE
      );
    });
  });

  it('reads no hash for a video without a password', async () => {
    await seed('unlisted');
    const hashOf = vi.spyOn(repositories.videoPasswords, 'hashOf');

    expectOk(await read({ credential: 'unlocked' }));

    expect(hashOf).not.toHaveBeenCalled();
  });
});
