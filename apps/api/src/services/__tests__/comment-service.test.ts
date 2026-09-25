import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { Singleflight } from '@vp/concurrency';
import type { CommentCachePort, HotComments } from '@vp/core/ports';
import { cacheUnavailable } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isOk, ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { CommentService } from '../comment-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const VIEWER: UserContext = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' };
const VIDEO_ID = '33333333-3333-7333-8333-333333333333';

class MapCommentCache implements CommentCachePort {
  readonly pages = new Map<string, HotComments>();
  invalidation: Result<void, ReturnType<typeof cacheUnavailable>> = ok();

  async getHot<E>(videoId: string, fetcher: () => Promise<Result<HotComments, E>>) {
    const cached = this.pages.get(videoId);
    if (cached) return ok(cached);
    const fetched = await fetcher();
    if (isOk(fetched)) this.pages.set(videoId, fetched.value);
    return fetched;
  }

  async invalidate(videoId: string) {
    this.pages.delete(videoId);
    return this.invalidation;
  }
}

describe('CommentService', () => {
  let repositories: InMemoryRepositories;
  let cache: MapCommentCache;
  let service: CommentService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    cache = new MapCommentCache();
    service = new CommentService({
      comments: repositories.comments,
      videos: repositories.videos,
      commentCache: cache,
      singleflight: new Singleflight(),
      paginator: new Paginator(),
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        visibility: 'public',
        status: 'READY',
      })
    );
    expectOk(await service.create(VIEWER, VIDEO_ID, { content: 'hello' }));
  });

  it('serves the first top page from the hot cache after one read', async () => {
    const listThreads = vi.spyOn(repositories.comments, 'listThreads');

    const first = expectOk(await service.listForVideo(null, VIDEO_ID, {}));
    const second = expectOk(await service.listForVideo(null, VIDEO_ID, {}));

    expect(listThreads).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first.total).toBe(1);
  });

  it('coalesces concurrent cold reads into one query', async () => {
    const listThreads = vi.spyOn(repositories.comments, 'listThreads');

    await Promise.all([
      service.listForVideo(null, VIDEO_ID, {}),
      service.listForVideo(VIEWER, VIDEO_ID, {}),
      service.listForVideo(OWNER, VIDEO_ID, {}),
    ]);

    expect(listThreads).toHaveBeenCalledTimes(1);
  });

  it.each([
    { scenario: 'the newest sort', query: { sort: 'newest' as const } },
    { scenario: 'a page size other than the default', query: { limit: 5 } },
    { scenario: 'a legacy page', query: { page: 1 } },
  ])('reads $scenario straight from the repository', async ({ query }) => {
    await service.listForVideo(null, VIDEO_ID, query);

    expect(cache.pages.size).toBe(0);
  });

  it('keeps a write that could not purge the cache', async () => {
    cache.invalidation = err(cacheUnavailable('del'));

    const created = await service.create(VIEWER, VIDEO_ID, { content: 'still saved' });

    expect(isOk(created)).toBe(true);
  });
});
