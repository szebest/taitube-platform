import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { PlaylistActivityService } from '../playlist-activity-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000a101', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000a102', role: 'USER' };
const PLAYLIST = '00000000-0000-7000-8000-00000000a1a1';
const VIDEO = '00000000-0000-7000-8000-00000000a1b1';
const ITEM = '00000000-0000-7000-8000-00000000a1c1';

async function setUp() {
  const repositories = new InMemoryRepositories();
  const service = new PlaylistActivityService({
    playlists: repositories.playlists,
    activity: repositories.playlistActivity,
    channels: repositories.channels,
    paginator: new Paginator(),
  });
  await seedVideo(repositories, { id: VIDEO, ownerId: OWNER.id, title: 'Clip' });
  expectOk(
    await repositories.playlists.create({
      id: PLAYLIST,
      ownerId: OWNER.id,
      title: 'Mix',
      description: '',
      visibility: 'private',
    })
  );
  expectOk(
    await repositories.playlists.addItem(
      PLAYLIST,
      { id: ITEM, videoId: VIDEO, addedBy: OWNER.id },
      OWNER.id
    )
  );
  return { repositories, service };
}

describe('PlaylistActivityService', () => {
  it('pages the log newest first with the actor channel, and hides it from a stranger', async () => {
    const { repositories, service } = await setUp();
    expectOk(
      await repositories.playlists.removeItem(PLAYLIST, { by: 'item', itemId: ITEM }, OWNER.id)
    );

    const first = expectOk(await service.list(OWNER, PLAYLIST, { limit: 1 }));
    const second = expectOk(
      await service.list(OWNER, PLAYLIST, { limit: 1, cursor: first.nextCursor ?? undefined })
    );

    expect(first.items).toMatchObject([
      { action: 'item_removed', actorUserId: OWNER.id, actor: { id: expect.any(String) } },
    ]);
    expect(second).toMatchObject({ items: [{ action: 'item_added' }], nextCursor: null });
    expect(expectErr(await service.list(STRANGER, PLAYLIST, {})).code).toBe(
      ErrorCodes.PLAYLIST_NOT_FOUND
    );
  });

  it('restores a removal once, and refuses any other change', async () => {
    const { repositories, service } = await setUp();
    expectOk(
      await repositories.playlists.removeItem(PLAYLIST, { by: 'item', itemId: ITEM }, OWNER.id)
    );
    const [removal, addition] = expectOk(await service.list(OWNER, PLAYLIST, {})).items;

    expectOk(await service.restore(OWNER, PLAYLIST, removal?.id ?? ''));

    expect(expectErr(await service.restore(OWNER, PLAYLIST, removal?.id ?? '')).code).toBe(
      ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE
    );
    expect(expectErr(await service.restore(OWNER, PLAYLIST, addition?.id ?? '')).code).toBe(
      ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE
    );
    expect(expectErr(await service.restore(OWNER, PLAYLIST, ITEM)).code).toBe(
      ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND
    );
  });
});
