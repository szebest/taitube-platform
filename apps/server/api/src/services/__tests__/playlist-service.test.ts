import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { asCdnBase } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { ViewerProgress } from '../viewer-progress';
import { PlaylistService } from '../playlist-service';
import { TEST_SPRITE } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000e001', role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-00000000e002';

describe('PlaylistService', () => {
  let repositories: InMemoryRepositories;
  let service: PlaylistService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new PlaylistService({
      playlists: repositories.playlists,
      videos: repositories.videos,
      viewerProgress: new ViewerProgress(repositories.watchHistory),
      cdn: asCdnBase('http://cdn.test'),
      sprite: TEST_SPRITE,
    });
    await seedVideo(repositories, { id: VIDEO, ownerId: OWNER.id, title: 'Clip' });
  });

  async function created(): Promise<string> {
    return expectOk(await service.create(OWNER, { title: 'Mix' })).id;
  }

  it('marks each item with the reader own playhead and nobody else', async () => {
    const { id } = expectOk(await service.create(OWNER, { title: 'Mix', visibility: 'public' }));
    expectOk(await service.addItem(OWNER, id, VIDEO));
    await repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-00000000e0a1',
      userId: OWNER.id,
      videoId: VIDEO,
      progressSeconds: 12,
      durationSeconds: 60,
      watchedAt: new Date('2026-03-01T12:00:00.000Z'),
    });

    const own = expectOk(await service.get(OWNER, id));
    const anonymous = expectOk(await service.get(null, id));

    expect(own.items[0]?.video.viewer).toMatchObject({ progressSeconds: 12 });
    expect(anonymous.items[0]?.video).not.toHaveProperty('viewer');
  });

  it.each([
    { outcome: 'playlist-missing' as const, code: ErrorCodes.PLAYLIST_NOT_FOUND },
    { outcome: 'video-missing' as const, code: ErrorCodes.VIDEO_NOT_FOUND },
  ])(
    'answers $code when the write finds $outcome after the decision passed',
    async ({ outcome, code }) => {
      const id = await created();
      vi.spyOn(repositories.playlists, 'addItem').mockResolvedValue(ok(outcome));

      expect(expectErr(await service.addItem(OWNER, id, VIDEO)).code).toBe(code);
    }
  );

  it.each([
    {
      name: 'reorder',
      act: (id: string): Promise<Result<unknown, { code: string }>> =>
        service.reorder(OWNER, id, { type: 'reindex', itemIds: [] }),
    },
    {
      name: 'remove',
      act: (id: string): Promise<Result<unknown, { code: string }>> => service.remove(OWNER, id),
    },
  ])(
    'answers PLAYLIST_NOT_FOUND when the playlist goes before the $name commits',
    async ({ act }) => {
      const id = await created();
      vi.spyOn(repositories.playlists, 'reorder').mockResolvedValue(ok(false));
      vi.spyOn(repositories.playlists, 'remove').mockResolvedValue(ok(false));

      expect(expectErr(await act(id)).code).toBe(ErrorCodes.PLAYLIST_NOT_FOUND);
    }
  );

  it('hands the reorder rule the items as the write transaction sees them', async () => {
    const id = await created();
    expectOk(await service.addItem(OWNER, id, VIDEO));
    vi.spyOn(repositories.playlists, 'reorder').mockImplementation(
      async (_playlistId, viewer, plan) => {
        expect(viewer).toBe(OWNER);
        const writes = plan([{ id: 'item-seen-inside', position: 0, hidden: false }]);
        return isErr(writes) ? writes : ok(true);
      }
    );

    const reordered = await service.reorder(OWNER, id, {
      type: 'reindex',
      itemIds: ['item-seen-inside', 'item-from-a-stale-view'],
    });

    expect(expectErr(reordered).code).toBe(ErrorCodes.VERSION_CONFLICT);
  });
});
