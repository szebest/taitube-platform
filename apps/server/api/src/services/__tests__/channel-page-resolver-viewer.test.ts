import { expectErr, expectOk } from '@kit/testing/result';
import type { ChannelPageView } from '@vp/api-contracts';
import type { ChannelLayout } from '@vp/domain';
import { homeWith, section } from './channel-page-fixtures';
import { FAN, NOW, setUpResolver, videoId } from './channel-page-resolver-setup';

const itemsOf = (page: ChannelPageView, id: string) => {
  const found = page.tab.sections.find((candidate) => candidate.id === id);
  return found && 'items' in found
    ? found.items.map((item) => ('title' in item ? item.title : item.channel.handle))
    : null;
};

describe('ChannelPageResolver for one viewer', () => {
  it('removes what the signed-in viewer watched when hideWatched is set, and leaves a guest the whole section', async () => {
    const { repositories, resolve } = await setUpResolver();
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
    const { resolve } = await setUpResolver();
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
    const { repositories, resolve } = await setUpResolver();
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
    const { resolve, resolver, channel } = await setUpResolver();
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
