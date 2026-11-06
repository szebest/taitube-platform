import { channelUrl, embedUrl, oembedUrl, videoUrl } from '../urls';

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
    {
      name: 'an embed',
      url: embedUrl('https://taitube.test', 'v1'),
      expected: 'https://taitube.test/embed/v1',
    },
    {
      name: 'an oEmbed document, through the app proxy',
      url: oembedUrl('https://taitube.test', 'v1'),
      expected:
        'https://taitube.test/api/v1/oembed?url=https%3A%2F%2Ftaitube.test%2Fwatch%2Fv1&format=json',
    },
  ])('puts $name on the site origin', ({ url, expected }) => {
    expect(url).toBe(expected);
  });
});
