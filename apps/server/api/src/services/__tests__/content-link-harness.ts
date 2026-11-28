import { expectOk } from '@kit/testing/result';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ActingChannel, ContentRef } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { ContentLinkCache } from '../content-link-cache';
import { ContentLinkNotifier } from '../content-link-notifier';
import { ContentLinkReads } from '../content-link-reads';
import { ContentLinkService } from '../content-link-service';

export const NOW = Date.parse('2026-11-10T12:00:00Z');

export const CREATOR_A: UserContext = {
  id: '00000000-0000-7000-8000-0000000a0001',
  role: 'CREATOR',
};
export const CREATOR_B: UserContext = {
  id: '00000000-0000-7000-8000-0000000b0001',
  role: 'CREATOR',
};
export const VIEWER: UserContext = { id: '00000000-0000-7000-8000-0000000c0001', role: 'USER' };
export const CHANNEL_A = '00000000-0000-7000-8000-0000000a00c1';
export const CHANNEL_B = '00000000-0000-7000-8000-0000000b00c1';

export const acting = (user: UserContext, channelId: string): ActingChannel => ({
  channelId,
  ownerId: user.id,
  role: 'owner',
});

export const video = (prefix: 'a' | 'b', n: number): Extract<ContentRef, { type: 'video' }> => ({
  type: 'video',
  id: `00000000-0000-7000-8000-0000000${prefix}01${String(n).padStart(2, '0')}`,
});

/** Never stores or finds anything: what a reader sees with the cache switched off. */
class ColdCache extends InMemoryCacheClient {
  override async get() {
    return super.get('cold');
  }
}

export async function linkHarness(options: { cache: 'on' | 'off' } = { cache: 'on' }) {
  const repositories = new InMemoryRepositories();
  const cache = new ContentLinkCache(
    options.cache === 'on' ? new InMemoryCacheClient() : new ColdCache()
  );
  for (const [user, id, handle] of [
    [CREATOR_A, CHANNEL_A, 'creator-a'],
    [CREATOR_B, CHANNEL_B, 'creator-b'],
  ] as const) {
    expectOk(await repositories.users.upsert({ id: user.id, email: `${handle}@example.test` }));
    expectOk(
      await repositories.channels.create({ id, userId: user.id, handle, displayName: handle })
    );
  }
  expectOk(await repositories.users.upsert({ id: VIEWER.id, email: 'viewer@example.test' }));

  const service = new ContentLinkService({
    links: repositories.contentLinks,
    refs: repositories.contentRefs,
    channels: repositories.channels,
    restrictions: repositories.channelUserRestrictions,
    stats: repositories.contentLinkStats,
    cache,
    notifier: new ContentLinkNotifier({
      channels: repositories.channels,
      members: repositories.channelMembers,
      notifications: repositories.notifications,
      audit: repositories.channelAudit,
    }),
    now: () => NOW,
  });
  const reads = new ContentLinkReads({
    links: repositories.contentLinks,
    refs: repositories.contentRefs,
    clips: repositories.clips,
    watchHistory: repositories.watchHistory,
    cache,
  });

  const seed = async (
    ref: ContentRef,
    owner: UserContext,
    channelId: string,
    overrides: Partial<Parameters<typeof seedVideo>[1]> = {}
  ) => {
    if (ref.type !== 'video') throw new Error('the harness seeds videos');
    return seedVideo(repositories, {
      id: ref.id,
      ownerId: owner.id,
      channelId,
      title: ref.id.slice(-4),
      durationMs: 600_000,
      ...overrides,
    });
  };

  const notificationsOf = async (user: UserContext) =>
    expectOk(await repositories.notifications.list(user.id, { filter: 'all', limit: 50 }));

  return { repositories, service, reads, seed, notificationsOf };
}
