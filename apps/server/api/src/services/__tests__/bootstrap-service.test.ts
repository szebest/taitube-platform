import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisCategoryCacheAdapter } from '@vp/adapters/redis/redis-category-cache.adapter';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { BootstrapService } from '../bootstrap-service';
import { CategoryService } from '../category-service';
import { ChannelService } from '../channel-service';

const CONFIG = inProcessAppConfig();

const USER = { id: '00000000-0000-7000-8000-0000000000b1', role: 'USER' } as const;

describe('apps/api/services: BootstrapService', () => {
  let repositories: InMemoryRepositories;
  let channelService: ChannelService;
  let service: BootstrapService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    channelService = new ChannelService({
      users: repositories.users,
      channels: repositories.channels,
      playlists: repositories.playlists,
    });
    const categoryService = new CategoryService({
      categories: repositories.categories,
      categoryCache: new RedisCategoryCacheAdapter({
        ...CONFIG.caches.categories,
        cache: new InMemoryCacheClient(),
      }),
      ...CONFIG.httpCache.categories,
    });
    service = new BootstrapService({
      channelService,
      categoryService,
      featureFlags: ['studio', 'live'],
    });
    expectOk(await repositories.categories.create({ slug: 'music', name: 'Music', sortOrder: 1 }));
  });

  it('gives a guest no user, the active categories and every enabled flag', async () => {
    const context = expectOk(await service.contextFor(null));

    expect(context.user).toBeNull();
    expect(context.categories.map((category) => category.slug)).toEqual(['music']);
    expect(context.featureFlags).toEqual({ studio: true, live: true });
  });

  it('gives a provisioned caller their own channel', async () => {
    expectOk(await channelService.ensureProvisioned(USER.id));

    const context = expectOk(await service.contextFor(USER));

    expect(context.user?.userId).toBe(USER.id);
    expect(context.categories).toHaveLength(1);
  });

  it('returns the account failure for a caller with no user record', async () => {
    const failure = expectErr(await service.contextFor(USER));

    expect(failure.code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});
