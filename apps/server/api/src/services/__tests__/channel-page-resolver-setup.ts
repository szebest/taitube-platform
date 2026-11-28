import { Singleflight } from '@kit/concurrency';
import { expectOk } from '@kit/testing/result';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelPageView } from '@vp/api-contracts';
import type { Channel, ChannelLayout, ViewerAudience } from '@vp/domain';
import { seedVideo } from '../../__tests__/test-app';
import { ChannelPageResolver, type ResolveRequest } from '../channel-page/channel-page-resolver';
import { TEST_CDN } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
export const FAN = '00000000-0000-7000-8000-0000000000a2';
const OTHER = '00000000-0000-7000-8000-0000000000a3';
export const PLAYLIST = '00000000-0000-7000-8000-0000000000b1';
export const NOW = Date.parse('2026-12-01T12:00:00.000Z');

export const videoId = (n: number) =>
  `00000000-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`;
export const postId = (n: number) =>
  `00000000-0000-7000-8000-0000000002${String(n).padStart(2, '0')}`;

export async function setUpResolver() {
  const repositories = new InMemoryRepositories();
  const cache = new InMemoryCacheClient();
  const channel = await seedChannel(repositories);
  const other = expectOk(
    await repositories.channels.create({ userId: OTHER, handle: 'other', displayName: 'Other' })
  );
  for (let n = 1; n <= 12; n += 1) {
    await seedVideo(repositories, {
      id: videoId(n),
      ownerId: OWNER,
      channelId: channel.id,
      title: `Video ${n}`,
      format: n > 9 ? 'short' : 'standard',
      viewsCount: n,
    });
  }
  await repositories.channelPosts.publish(
    {
      id: postId(1),
      channelId: channel.id,
      authorUserId: OWNER,
      payload: { kind: 'text', text: 'Hello' },
      commentsEnabled: true,
    },
    {
      channelId: channel.id,
      actorUserId: OWNER,
      action: 'post.published',
      targetType: 'post',
      targetId: postId(1),
      meta: { kind: 'text' },
    }
  );
  await repositories.playlists.create({
    id: PLAYLIST,
    ownerId: OWNER,
    title: 'Series',
    description: '',
    visibility: 'public',
  });
  await repositories.playlists.addItem(
    PLAYLIST,
    { id: '00000000-0000-7000-8000-000000000301', videoId: videoId(1), addedBy: OWNER },
    OWNER
  );

  const calls = {
    pool: vi.spyOn(repositories.channelPageSources, 'pool'),
    playlistItems: vi.spyOn(repositories.channelPageSources, 'playlistItems'),
    smart: vi.spyOn(repositories.channelPageSources, 'smart'),
    startHere: vi.spyOn(repositories.channelPageSources, 'startHere'),
    hydrate: vi.spyOn(repositories.channelPageSources, 'hydrate'),
  };
  const queries = () => Object.values(calls).reduce((sum, call) => sum + call.mock.calls.length, 0);
  const resolver = new ChannelPageResolver({
    sources: repositories.channelPageSources,
    images: repositories.channelImages,
    history: repositories.watchHistory,
    cache,
    singleflight: new Singleflight(),
    cdn: TEST_CDN,
    now: () => NOW,
  });
  const resolve = async (
    layout: ChannelLayout,
    overrides: Partial<ResolveRequest> & { audience?: ViewerAudience } = {}
  ): Promise<ChannelPageView> =>
    expectOk(
      await resolver.resolve({
        channel,
        layout,
        revision: 1,
        cached: true,
        audience: 'guest',
        locales: ['en'],
        viewerId: null,
        tab: undefined,
        seed: 'visit-1',
        idOrHandle: 'owner',
        ...overrides,
      })
    );
  return { repositories, calls, queries, resolve, resolver, channel, other };
}

async function seedChannel(repositories: InMemoryRepositories): Promise<Channel> {
  await repositories.users.upsert({
    id: OWNER,
    email: 'o@example.com',
    role: 'USER',
    tier: 'free',
  });
  return expectOk(
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' })
  );
}
