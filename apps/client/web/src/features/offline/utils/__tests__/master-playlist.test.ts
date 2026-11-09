import { singleVariantMaster } from '../master-playlist';

describe('apps/client/web: singleVariantMaster', () => {
  it.each([
    {
      name: 'names the rendition with its resolution',
      rendition: { playlistUrl: 'https://cdn/a.m3u8', bandwidth: 364000, width: 426, height: 240 },
      line: '#EXT-X-STREAM-INF:BANDWIDTH=364000,RESOLUTION=426x240',
    },
    {
      name: 'leaves the resolution out when the ladder did not know it',
      rendition: { playlistUrl: 'https://cdn/a.m3u8', bandwidth: 800000 },
      line: '#EXT-X-STREAM-INF:BANDWIDTH=800000',
    },
  ])('$name', ({ rendition, line }) => {
    expect(singleVariantMaster(rendition)).toBe(
      ['#EXTM3U', line, 'https://cdn/a.m3u8', ''].join('\n')
    );
  });
});
