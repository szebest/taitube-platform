import { Singleflight } from '@kit/concurrency';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ChannelPageView } from '@vp/api-contracts';
import type {
  Channel,
  ChannelLayout,
  ContentSection,
  LayoutVisibility,
  ViewerAudience,
} from '@vp/domain';
import { seedVideo } from '../../__tests__/test-app';
import { ChannelPageResolver, type ResolveRequest } from '../channel-page/channel-page-resolver';
import { homeWith, section } from './channel-page-fixtures';
import { TEST_CDN } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const FAN = '00000000-0000-7000-8000-0000000000a2';
const OTHER = '00000000-0000-7000-8000-0000000000a3';
const PLAYLIST = '00000000-0000-7000-8000-0000000000b1';
const NOW = Date.parse('2026-12-01T12:00:00.000Z');

const videoId = (n: number) => `00000000-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`;
const postId = (n: number) => `00000000-0000-7000-8000-0000000002${String(n).padStart(2, '0')}`;

async function setUp() {
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

const itemsOf = (page: ChannelPageView, id: string) => {
  const found = page.tab.sections.find((candidate) => candidate.id === id);
  return found && 'items' in found
    ? found.items.map((item) => ('title' in item ? item.title : item.channel.handle))
    : null;
};

describe('ChannelPageResolver', () => {
  it('reads one query per source type and one hydration for a 20-section layout, then serves the cache', async () => {
    const { calls, queries, resolve, other } = await setUp();
    const sources: ContentSection['source'][] = [
      { type: 'videos' },
      { type: 'videos' },
      { type: 'videos' },
      { type: 'shorts' },
      { type: 'shorts' },
      { type: 'posts' },
      { type: 'posts' },
      { type: 'live' },
      { type: 'playlists' },
      { type: 'playlists' },
      { type: 'playlist', playlistId: PLAYLIST },
      { type: 'playlist', playlistId: PLAYLIST },
      { type: 'picked', items: [{ kind: 'video', id: videoId(2) }] },
      { type: 'picked', items: [{ kind: 'post', id: postId(1) }] },
      { type: 'start_here' },
      { type: 'start_here' },
      { type: 'smart_playlist', rules: { match: 'all', conditions: [], sort: 'newest', limit: 5 } },
      {
        type: 'smart_playlist',
        rules: { match: 'all', conditions: [], sort: 'popular', limit: 5 },
      },
    ];
    const layout = homeWith(
      ...sources.map((source, index) =>
        section(`s${index}`, {
          source,
          sort: source.type === 'picked' ? 'manual' : 'newest',
          hideWhenEmpty: false,
        })
      ),
      {
        kind: 'featured_channels',
        id: 'friends-1',
        channelIds: [other.id],
        presentation: section('x').presentation,
        visibility: section('x').visibility,
      },
      {
        kind: 'featured_channels',
        id: 'friends-2',
        channelIds: [other.id],
        presentation: section('x').presentation,
        visibility: section('x').visibility,
      }
    );

    const first = await resolve(layout);
    const afterFirst = queries();

    expect(first.tab.sections).toHaveLength(20);
    expect(calls.pool.mock.calls.map(([, , type]) => type).sort()).toEqual([
      'live',
      'playlists',
      'posts',
      'shorts',
      'videos',
    ]);
    expect(
      [calls.playlistItems, calls.smart, calls.startHere, calls.hydrate].map(
        (call) => call.mock.calls.length
      )
    ).toEqual([1, 1, 1, 1]);
    expect(afterFirst).toBeLessThanOrEqual(10 + 1);

    const second = await resolve(layout);

    expect(queries()).toBe(afterFirst);
    expect(second).toEqual(first);
  });

  it('keeps a cache entry per audience: a subscriber section is absent for a guest and present for a subscriber', async () => {
    const { queries, resolve } = await setUp();
    const layout = homeWith(
      section('everyone'),
      section('perk', {
        visibility: { audience: 'subscribers', from: null, to: null, locales: [] },
      })
    );
    const ids = (page: ChannelPageView) => page.tab.sections.map(({ id }) => id);

    const guest = await resolve(layout);
    const guestAgain = await resolve(layout);
    const afterGuest = queries();
    const subscriber = await resolve(layout, { audience: 'subscriber' });

    expect(ids(guest)).toEqual(['everyone']);
    expect(guestAgain).toEqual(guest);
    expect(ids(subscriber)).toEqual(['everyone', 'perk']);
    expect(queries()).toBeGreaterThan(afterGuest);
  });

  it.each<{ scenario: string; visibility: LayoutVisibility; locales: string[] }>([
    {
      scenario: 'outside its window',
      visibility: { audience: 'everyone', from: null, to: '2026-11-30T00:00:00.000Z', locales: [] },
      locales: ['en'],
    },
    {
      scenario: 'in another locale',
      visibility: { audience: 'everyone', from: null, to: null, locales: ['pl'] },
      locales: ['en'],
    },
  ])('drops a section $scenario', async ({ visibility, locales }) => {
    const { resolve } = await setUp();

    const page = await resolve(homeWith(section('gone', { visibility })), { locales });

    expect(page.tab.sections).toEqual([]);
  });

  it('drops an empty section marked hideWhenEmpty and keeps one that is not', async () => {
    const { resolve } = await setUp();
    const layout = homeWith(
      section('hidden', { source: { type: 'live' }, hideWhenEmpty: true }),
      section('shown', { source: { type: 'live' }, hideWhenEmpty: false })
    );

    const page = await resolve(layout);

    expect(page.tab.sections.map(({ id }) => id)).toEqual(['shown']);
  });

  it('removes what the signed-in viewer watched when hideWatched is set, and leaves a guest the whole section', async () => {
    const { repositories, resolve } = await setUp();
    const shelf = section('shelf', {
      itemCount: 12,
      filters: { tags: [], dateRange: null, duration: null, hideWatched: true },
    });
    expectOk(
      await repositories.watchHistory.record({
        id: '00000000-0000-7000-8000-000000000401',
        userId: FAN,
        videoId: videoId(9),
        progressSeconds: 100,
        durationSeconds: 100,
        watchedAt: new Date(NOW),
      })
    );

    const guest = await resolve(homeWith(shelf));
    const member = await resolve(homeWith(shelf), { audience: 'member', viewerId: FAN });

    expect(itemsOf(guest, 'shelf')).toContain('Video 9');
    expect(itemsOf(member, 'shelf')).not.toContain('Video 9');
    expect(itemsOf(member, 'shelf')?.length).toBe((itemsOf(guest, 'shelf')?.length ?? 0) - 1);
  });

  it('orders a random section by its seed, so one visit is stable and another is not', async () => {
    const { resolve } = await setUp();
    const layout = homeWith(section('mix', { sort: 'random', itemCount: 9 }));

    const [a, b, c] = [
      await resolve(layout, { seed: 'visit-1' }),
      await resolve(layout, { seed: 'visit-1' }),
      await resolve(layout, { seed: 'visit-2' }),
    ];

    expect(itemsOf(b, 'mix')).toEqual(itemsOf(a, 'mix'));
    expect(itemsOf(c, 'mix')).not.toEqual(itemsOf(a, 'mix'));
  });

  it('drops a picked video that turned private, with no save', async () => {
    const { repositories, resolve } = await setUp();
    const layout = homeWith(
      section('picks', {
        source: {
          type: 'picked',
          items: [
            { kind: 'video', id: videoId(2) },
            { kind: 'video', id: videoId(3) },
          ],
        },
        sort: 'manual',
      })
    );
    expect(itemsOf(await resolve(layout, { cached: false }), 'picks')).toEqual([
      'Video 2',
      'Video 3',
    ]);

    const stored = expectOk(await repositories.videos.findById(videoId(2)));
    if (stored) stored.visibility = 'private';

    expect(itemsOf(await resolve(layout, { cached: false }), 'picks')).toEqual(['Video 3']);
  });

  it('refuses a tab the viewer cannot see, and lands a subscriber on the tab the layout names', async () => {
    const { resolve, resolver, channel } = await setUp();
    const layout: ChannelLayout = {
      ...homeWith(section('s')),
      landing: { visitor: 'home', subscriber: 'videos' },
    };

    const landed = await resolve(layout, { audience: 'subscriber' });
    const missing = await resolver.resolve({
      channel,
      layout,
      revision: 1,
      cached: true,
      audience: 'guest',
      locales: ['en'],
      viewerId: null,
      tab: 'nope',
      seed: undefined,
      idOrHandle: 'owner',
    });

    expect(landed.tab.slug).toBe('videos');
    expect(expectErr(missing).code).toBe('CHANNEL_NOT_FOUND');
  });
});
