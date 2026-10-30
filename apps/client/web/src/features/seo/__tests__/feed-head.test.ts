import { videoSummary } from '@vp/web-testing';

import { feedHead } from '../feed-head';

const OPTIONS = {
  path: '/feed/trending',
  title: 'Trending',
  description: 'Hot.',
  siteUrl: 'https://taitube.test',
};

describe('apps/client/web: feedHead', () => {
  it('titles the page, links its canonical URL, lists the videos and borrows the first thumbnail', () => {
    const head = feedHead({
      ...OPTIONS,
      videos: [videoSummary({ thumbnailUrl: 'https://cdn.test/t.jpg' }), videoSummary()],
    });

    expect(head.meta).toContainEqual({ title: 'Trending' });
    expect(head.meta).toContainEqual({ property: 'og:image', content: 'https://cdn.test/t.jpg' });
    expect(head.links).toEqual([{ rel: 'canonical', href: 'https://taitube.test/feed/trending' }]);
    expect(JSON.parse(head.scripts[0]?.children ?? '').itemListElement).toHaveLength(2);
  });

  it('still renders an empty list', () => {
    expect(feedHead({ ...OPTIONS, videos: [] }).meta).not.toContainEqual(
      expect.objectContaining({ property: 'og:image' })
    );
  });
});
