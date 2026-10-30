import { channelUrl, videoUrl } from '../urls';

describe('apps/client/web: seo urls', () => {
  it.each([
    {
      name: 'a video',
      url: videoUrl('https://taitube.test', 'v1'),
      expected: 'https://taitube.test/watch/v1',
    },
    {
      name: 'a channel',
      url: channelUrl('https://taitube.test', 'c1'),
      expected: 'https://taitube.test/channel/c1',
    },
  ])('puts $name on the site origin', ({ url, expected }) => {
    expect(url).toBe(expected);
  });
});
