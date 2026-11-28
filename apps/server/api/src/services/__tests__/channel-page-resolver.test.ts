import type { ChannelPageView } from '@vp/api-contracts';
import type { ContentSection, LayoutVisibility } from '@vp/domain';
import { homeWith, section } from './channel-page-fixtures';
import { PLAYLIST, postId, setUpResolver, videoId } from './channel-page-resolver-setup';

describe('ChannelPageResolver', () => {
  it('reads one query per source type and one hydration for a 20-section layout, then serves the cache', async () => {
    const { calls, queries, resolve, other } = await setUpResolver();
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
    const { queries, resolve } = await setUpResolver();
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
    const { resolve } = await setUpResolver();

    const page = await resolve(homeWith(section('gone', { visibility })), { locales });

    expect(page.tab.sections).toEqual([]);
  });

  it('drops an empty section marked hideWhenEmpty and keeps one that is not', async () => {
    const { resolve } = await setUpResolver();
    const layout = homeWith(
      section('hidden', { source: { type: 'live' }, hideWhenEmpty: true }),
      section('shown', { source: { type: 'live' }, hideWhenEmpty: false })
    );

    const page = await resolve(layout);

    expect(page.tab.sections.map(({ id }) => id)).toEqual(['shown']);
  });
});
