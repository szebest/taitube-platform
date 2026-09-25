import { inProcessAppConfig } from '@vp/env-schema';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ReactionService } from '../reaction-service';

const CACHES = inProcessAppConfig().caches;

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';
const OWNER_ID = '00000000-0000-7000-8000-0000000000a2';

function makeService(repositories: InMemoryRepositories): ReactionService {
  return new ReactionService({
    videoReactions: repositories.videoReactions,
    reactionCache: new RedisReactionCacheAdapter({
      ...CACHES.reactions,
      backend: { type: 'cache', cache: new InMemoryCacheClient() },
    }),
    videos: repositories.videos,
  });
}

async function seedVideo(repositories: InMemoryRepositories): Promise<void> {
  await repositories.videos.create({
    id: VIDEO_ID,
    ownerId: OWNER_ID,
    title: 'Reactions fixture',
    visibility: 'public',
    status: 'READY',
    sourceKey: 'raw/reactions.mp4',
  });
}

describe('apps/api/services: ReactionService', () => {
  let repositories: InMemoryRepositories;
  let service: ReactionService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = makeService(repositories);
    await seedVideo(repositories);
  });

  it('records a reaction for a role that holds the react permission', async () => {
    const recorded = expectOk(
      await service.setReaction({ id: OWNER_ID, role: 'USER' }, VIDEO_ID, 'LIKE')
    );

    expect(recorded).toMatchObject({ videoId: VIDEO_ID, reaction: 'LIKE', likesCount: 1 });
  });

  it('refuses a guest caller with FORBIDDEN and writes nothing', async () => {
    const refused = expectErr(
      await service.setReaction({ id: OWNER_ID, role: 'GUEST' }, VIDEO_ID, 'LIKE')
    );

    expect(refused.code).toBe(ErrorCodes.FORBIDDEN);
    expect(
      expectOk(await repositories.videoReactions.getUserReaction(VIDEO_ID, OWNER_ID))
    ).toBeNull();
  });

  it.each([{ role: 'USER' as const }, { role: 'GUEST' as const }])(
    'reports a missing video as VIDEO_NOT_FOUND for a $role, because the read decides before the permission',
    async ({ role }) => {
      const failure = expectErr(
        await service.setReaction({ id: OWNER_ID, role }, 'missing-video', 'LIKE')
      );

      expect(failure.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    }
  );

  it('reads back the caller reaction and the aggregate counts', async () => {
    await service.setReaction({ id: OWNER_ID, role: 'USER' }, VIDEO_ID, 'DISLIKE');

    expect(
      expectOk(await service.getUserReaction({ id: OWNER_ID, role: 'USER' }, VIDEO_ID))
    ).toEqual({ videoId: VIDEO_ID, reaction: 'DISLIKE' });
    expect(expectOk(await service.getCounts(VIDEO_ID))).toMatchObject({
      likesCount: 0,
      dislikesCount: 1,
    });
  });
});
