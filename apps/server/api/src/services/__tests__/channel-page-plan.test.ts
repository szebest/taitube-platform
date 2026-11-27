import { planPage, probeKey } from '../channel-page/channel-page-plan';
import { homeWith, section } from './channel-page-fixtures';

const NOW = new Date('2026-12-01T12:00:00.000Z');

describe('planPage', () => {
  it('groups sections by source type and probes each fixed tab once', () => {
    const plan = planPage({
      layout: homeWith(
        section('a'),
        section('b', { sort: 'random', itemCount: 3 }),
        section('c', { source: { type: 'posts' } }),
        section('d', { source: { type: 'start_here' }, itemCount: 4 })
      ),
      audience: 'guest',
      locales: ['en'],
      now: NOW,
    });

    expect(plan.pool.videos.map(({ key, limit }) => [key, limit])).toEqual([
      ['a', 6],
      ['b', 48],
      [probeKey('videos'), 1],
    ]);
    expect(plan.pool.posts.map(({ key }) => key)).toEqual(['c', probeKey('posts')]);
    expect(plan.startHere).toEqual({ limit: 4, sections: [{ id: 'd', limit: 4 }] });
  });

  it('turns a last-days range into a window counted back from now', () => {
    const plan = planPage({
      layout: homeWith(
        section('recent', {
          filters: {
            tags: [],
            dateRange: { type: 'last_days', days: 2 },
            duration: null,
            hideWatched: false,
          },
        })
      ),
      audience: 'guest',
      locales: ['en'],
      now: NOW,
    });

    expect(plan.pool.videos[0]?.since).toEqual(new Date('2026-11-29T12:00:00.000Z'));
  });

  it('leaves out what the audience may not see and what a hidden tab holds', () => {
    const layout = homeWith(
      section('perk', {
        visibility: { audience: 'subscribers', from: null, to: null, locales: [] },
      })
    );
    const hiddenVideos = {
      ...layout,
      tabs: layout.tabs.map((tab) => (tab.kind === 'videos' ? { ...tab, hidden: true } : tab)),
    };
    const plan = (audience: 'guest' | 'subscriber', withLayout = layout) =>
      planPage({ layout: withLayout, audience, locales: ['en'], now: NOW });

    expect(plan('guest').pool.videos.map(({ key }) => key)).toEqual([probeKey('videos')]);
    expect(plan('subscriber').pool.videos.map(({ key }) => key)).toEqual([
      'perk',
      probeKey('videos'),
    ]);
    expect(plan('guest', hiddenVideos).pool.videos).toEqual([]);
  });
});
