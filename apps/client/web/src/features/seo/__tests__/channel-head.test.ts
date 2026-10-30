import { channel, videoSummary } from '@vp/web-testing';

import { channelHead } from '../channel-head';

const SITE = 'https://taitube.test';

describe('apps/client/web: channelHead', () => {
  it.each([
    { scenario: 'its bio', bio: 'Short films.', expected: 'Short films.' },
    {
      scenario: 'a line about the channel without a bio',
      bio: null,
      expected: 'Videos by The Creator on Taitube.',
    },
  ])('describes the channel by $scenario', ({ bio, expected }) => {
    const { meta } = channelHead(channel({ bio }), [], SITE);

    expect(meta).toContainEqual({ name: 'description', content: expected });
  });

  it('titles the page with the channel, links its canonical URL and lists its videos', () => {
    const owned = channel();

    const head = channelHead(owned, [videoSummary({ title: 'One' })], SITE);

    expect(head.meta).toContainEqual({ title: 'The Creator' });
    expect(head.links).toEqual([{ rel: 'canonical', href: `${SITE}/channel/${owned.id}` }]);
    expect(JSON.parse(head.scripts[0]?.children ?? '')).toMatchObject({
      '@type': 'ItemList',
      itemListElement: [{ position: 1 }],
    });
  });
});
