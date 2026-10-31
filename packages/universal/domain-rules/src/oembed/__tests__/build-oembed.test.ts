import { buildOEmbed } from '../build-oembed';

const WEB = 'https://taitube.test';
const VIDEO = { id: 'v1', title: 'Building a Pipeline' };
const CHANNEL = { id: 'c1', handle: 'mateusz', displayName: 'Mateusz', avatarUrl: null };
const SIZE = { width: 640, height: 360 };

describe('@vp/domain-rules: buildOEmbed', () => {
  it('describes a video the way oEmbed 1.0 asks for', () => {
    expect(
      buildOEmbed({
        video: VIDEO,
        channel: CHANNEL,
        webOrigin: WEB,
        thumbnailUrl: 'https://cdn.test/posters/v1.jpg',
        size: SIZE,
      })
    ).toEqual({
      type: 'video',
      version: '1.0',
      title: 'Building a Pipeline',
      author_name: 'Mateusz',
      author_url: `${WEB}/channel/c1`,
      provider_name: 'Taitube',
      provider_url: WEB,
      thumbnail_url: 'https://cdn.test/posters/v1.jpg',
      thumbnail_width: 1280,
      thumbnail_height: 720,
      html: `<iframe src="${WEB}/embed/v1" width="640" height="360" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
      width: 640,
      height: 360,
    });
  });

  it('sizes the iframe to the box it was given', () => {
    const embed = buildOEmbed({
      video: VIDEO,
      channel: null,
      webOrigin: WEB,
      thumbnailUrl: undefined,
      size: { width: 320, height: 180 },
    });

    expect(embed).toMatchObject({ width: 320, height: 180 });
    expect(embed.html).toContain('width="320" height="180"');
  });

  it('leaves out what the video does not have', () => {
    const embed = buildOEmbed({
      video: { id: 'v1', title: null },
      channel: null,
      webOrigin: WEB,
      thumbnailUrl: undefined,
      size: SIZE,
    });

    expect(Object.keys(embed)).toEqual([
      'type',
      'version',
      'provider_name',
      'provider_url',
      'html',
      'width',
      'height',
    ]);
  });
});
