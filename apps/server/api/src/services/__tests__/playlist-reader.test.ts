import { randomUUID } from 'node:crypto';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { playlistReading } from './playlist-reading';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' };
const FAN: UserContext = { id: '00000000-0000-7000-8000-0000000000a2', role: 'USER' };
const LIST = '00000000-0000-7000-8000-0000000000a3';
const VIDEO = '00000000-0000-7000-8000-0000000000aa';
const NO_ACCESS = { shareToken: null, sessionKey: null };

async function setUp(visibility: 'public' | 'private', rules = false) {
  const repositories = new InMemoryRepositories();
  await seedVideo(repositories, { id: VIDEO, ownerId: OWNER.id, title: 'Clip' });
  expectOk(
    await repositories.playlists.create({
      id: LIST,
      ownerId: OWNER.id,
      title: 'Mix',
      description: '',
      visibility,
      rules: rules ? { match: 'all', conditions: [], sort: 'newest', limit: 5 } : null,
    })
  );
  const reading = playlistReading(repositories);
  const opens = async () =>
    (expectOk(await reading.viewBuffer.snapshot(randomUUID()))?.playlists ?? []).reduce(
      (sum, row) => sum + row.opens,
      0
    );
  return { ...reading, repositories, opens };
}

describe('PlaylistReader', () => {
  it('counts the opens of everyone but the owner', async () => {
    const { reader, opens } = await setUp('public');

    expectOk(await reader.open(OWNER, LIST, NO_ACCESS));
    expectOk(await reader.open(FAN, LIST, NO_ACCESS));
    expectOk(await reader.open(null, LIST, { shareToken: null, sessionKey: 'tab-1' }));
    expectOk(await reader.get(FAN, LIST));

    expect(await opens()).toBe(2);
  });

  it('reads a private playlist through its link, and answers a dead one 410', async () => {
    const { reader, sharing } = await setUp('private');
    const link = expectOk(await sharing.create(OWNER, LIST, { expiresIn: '1h' }));

    expect(
      expectOk(await reader.open(null, LIST, { ...NO_ACCESS, shareToken: link.token })).id
    ).toBe(LIST);
    expect(expectErr(await reader.open(null, LIST, NO_ACCESS)).code).toBe(
      ErrorCodes.PLAYLIST_NOT_FOUND
    );

    expectOk(await sharing.revoke(OWNER, LIST, link.id));

    expect(
      expectErr(await reader.open(null, LIST, { ...NO_ACCESS, shareToken: link.token })).code
    ).toBe(ErrorCodes.SHARE_LINK_EXPIRED);
  });

  it.each([
    { scenario: 'its owner', viewer: OWNER, stands: { role: 'owner', following: false } },
    { scenario: 'a follower', viewer: FAN, stands: { role: null, following: true } },
    { scenario: 'a guest', viewer: null, stands: { role: null, following: false } },
  ])('tells $scenario where they stand on the page', async ({ viewer, stands }) => {
    const { reader, repositories } = await setUp('public');
    expectOk(await repositories.playlistLibrary.follow(FAN.id, LIST));

    expect(expectOk(await reader.open(viewer, LIST, NO_ACCESS)).viewer).toEqual(stands);
  });

  it('shows the items a smart playlist computes, with the viewer progress on each', async () => {
    const { reader } = await setUp('public', true);

    const view = expectOk(await reader.get(OWNER, LIST));

    expect(view).toMatchObject({
      videoCount: 1,
      rules: expect.objectContaining({ limit: 5 }),
      items: [expect.objectContaining({ videoId: VIDEO, position: 0 })],
    });
  });
});
