import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { playlistReading } from './playlist-reading';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000c1', role: 'USER' };
const LIST = '00000000-0000-7000-8000-0000000000c2';
const OTHER = '00000000-0000-7000-8000-0000000000c3';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');

async function setUp() {
  const repositories = new InMemoryRepositories();
  for (const id of [LIST, OTHER]) {
    expectOk(
      await repositories.playlists.create({
        id,
        ownerId: OWNER.id,
        title: 'Mix',
        description: '',
        visibility: 'private',
      })
    );
  }
  const { sharing } = playlistReading(repositories, () => NOW);
  return { repositories, sharing };
}

describe('PlaylistSharingService', () => {
  it('proves a read of its own playlist alone, and nothing without a token', async () => {
    const { sharing } = await setUp();
    const link = expectOk(await sharing.create(OWNER, LIST, { expiresIn: '1h' }));

    expect(expectOk(await sharing.shareOf(link.token, LIST))?.grant).toEqual({
      targetType: 'playlist',
      targetId: LIST,
    });
    expect([
      expectOk(await sharing.shareOf(link.token, OTHER)),
      expectOk(await sharing.shareOf(null, LIST)),
    ]).toEqual([null, null]);
  });

  it('answers a revoked link of the playlist as expired', async () => {
    const { sharing } = await setUp();
    const link = expectOk(await sharing.create(OWNER, LIST, { expiresIn: 'never' }));
    expectOk(await sharing.revoke(OWNER, LIST, link.id));

    expect(expectErr(await sharing.shareOf(link.token, LIST))).toMatchObject({
      code: ErrorCodes.SHARE_LINK_EXPIRED,
      targetType: 'playlist',
      targetId: LIST,
    });
  });

  it('refuses a label over 60 characters, and a revoke of a link it never had', async () => {
    const { sharing } = await setUp();

    const label = await sharing.create(OWNER, LIST, { label: 'x'.repeat(61), expiresIn: '1h' });
    const revoke = await sharing.revoke(OWNER, LIST, '00000000-0000-7000-8000-0000000000c9');

    expect([expectErr(label).code, expectErr(revoke).code]).toEqual([
      ErrorCodes.VALIDATION_FAILED,
      ErrorCodes.SHARE_LINK_NOT_FOUND,
    ]);
  });

  it('reads the stats of the range, ending today', async () => {
    const { sharing } = await setUp();

    expect(expectOk(await sharing.stats(OWNER, LIST, '7d'))).toEqual({
      from: '2026-11-14',
      to: '2026-11-20',
      opens: 0,
      plays: 0,
      follows: 0,
      forks: 0,
      topItems: [],
    });
  });
});
