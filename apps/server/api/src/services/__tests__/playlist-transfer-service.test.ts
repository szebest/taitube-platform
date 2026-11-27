import { randomUUID } from 'node:crypto';
import { ok } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { PlaylistTransferService } from '../playlist-transfer-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000f101', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000f102', role: 'USER' };
const VIDEOS = ['00000000-0000-7000-8000-00000000f1b1', '00000000-0000-7000-8000-00000000f1b2'];

async function setUp() {
  const repositories = new InMemoryRepositories();
  const service = new PlaylistTransferService({
    playlists: repositories.playlists,
    newId: randomUUID,
  });
  for (const id of VIDEOS) await seedVideo(repositories, { id, ownerId: OWNER.id, title: id });
  const playlist = async (
    videoIds: readonly string[],
    visibility: 'private' | 'public' = 'private'
  ) => {
    const { id } = expectOk(
      await repositories.playlists.create({
        id: randomUUID(),
        ownerId: OWNER.id,
        title: 'Mix',
        description: '',
        visibility,
      })
    );
    for (const videoId of videoIds) {
      expectOk(
        await repositories.playlists.addItem(
          id,
          { id: randomUUID(), videoId, addedBy: OWNER.id },
          OWNER.id
        )
      );
    }
    return id;
  };
  const order = async (playlistId: string) =>
    expectOk(await repositories.playlists.findItems(playlistId)).map((item) => item.videoId);
  const contributingTo = async () => {
    const { id } = expectOk(
      await repositories.playlists.create({
        id: randomUUID(),
        ownerId: STRANGER.id,
        title: 'Shared',
        description: '',
        visibility: 'private',
      })
    );
    const token = randomUUID();
    expectOk(
      await repositories.playlistCollaborators.createInvite({
        id: randomUUID(),
        playlistId: id,
        role: 'contributor',
        token,
        inviteeUserId: null,
        createdBy: STRANGER.id,
        expiresAt: new Date(Date.now() + 60_000),
        maxUses: null,
        useCount: 0,
        revokedAt: null,
        createdAt: new Date(),
      })
    );
    expectOk(
      await repositories.playlistCollaborators.accept(token, OWNER.id, () =>
        ok({ playlistId: id, role: 'contributor' as const })
      )
    );
    return id;
  };
  return { repositories, service, playlist, order, contributingTo };
}

describe('PlaylistTransferService', () => {
  it('copies items, reporting a duplicate as skipped and leaving the source whole', async () => {
    const { repositories, service, playlist, order } = await setUp();
    const source = await playlist(VIDEOS);
    const target = await playlist([VIDEOS[1] ?? '']);
    const itemIds = expectOk(await repositories.playlists.findItems(source)).map((item) => item.id);

    const batch = expectOk(
      await service.transfer(OWNER, source, { itemIds, to: target, mode: 'copy' })
    );

    expect(batch.results.map((result) => [result.ok, result.duplicate])).toEqual([
      [true, false],
      [true, true],
    ]);
    expect(await order(source)).toEqual(VIDEOS);
  });

  it('refuses a section where the actor only contributes, and keeps a merge source it could not empty', async () => {
    const { repositories, service, playlist, contributingTo } = await setUp();
    const source = await playlist([VIDEOS[0] ?? '']);
    const section = { id: randomUUID(), title: 'Part 1', addedBy: OWNER.id };
    expectOk(await repositories.playlists.addSection(source, section, OWNER.id));
    const target = await contributingTo();
    const itemIds = expectOk(await repositories.playlists.findItems(source)).map((item) => item.id);

    const copied = expectOk(
      await service.transfer(OWNER, source, { itemIds, to: target, mode: 'copy' })
    );
    const merged = expectOk(
      await service.merge(OWNER, { sourceIds: [source], into: target, deleteSources: true })
    );

    expect([copied, merged].map(({ results }) => results.map((result) => result.code))).toEqual([
      [undefined, ErrorCodes.FORBIDDEN],
      [undefined, ErrorCodes.FORBIDDEN],
    ]);
    expect(expectOk(await repositories.playlists.findById(source))).not.toBeNull();
    expect(
      expectOk(await repositories.playlists.findItems(target)).map((item) => item.kind)
    ).toEqual(['video']);
  });

  it.each([
    { scenario: 'into the playlist itself', to: 'same', code: ErrorCodes.VALIDATION_FAILED },
    {
      scenario: 'into a playlist that is not there',
      to: randomUUID(),
      code: ErrorCodes.PLAYLIST_NOT_FOUND,
    },
  ])('refuses a move $scenario', async ({ to, code }) => {
    const { service, playlist } = await setUp();
    const source = await playlist(VIDEOS);

    const moved = await service.transfer(OWNER, source, {
      itemIds: [],
      to: to === 'same' ? source : to,
      mode: 'move',
    });

    expect(expectErr(moved).code).toBe(code);
  });

  it('duplicates a public playlist for a stranger, and merges deleting only what they may delete', async () => {
    const { service, playlist, order } = await setUp();
    const source = await playlist(VIDEOS, 'public');

    const copy = expectOk(await service.duplicate(STRANGER, source, {}));
    const refused = await service.merge(STRANGER, {
      sourceIds: [source],
      newTitle: 'Mine',
      deleteSources: true,
    });
    const merged = expectOk(
      await service.merge(STRANGER, {
        sourceIds: [copy.playlistId],
        newTitle: 'Mine',
        deleteSources: true,
      })
    );

    expect(await order(copy.playlistId)).toEqual([]);
    expect(await order(merged.playlistId)).toEqual(VIDEOS);
    expect(expectErr(refused).code).toBe(ErrorCodes.FORBIDDEN);
  });
});
