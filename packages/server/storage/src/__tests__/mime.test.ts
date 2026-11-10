import {
  CAPTIONS_TRACK_HEADERS,
  getHeaderMapping,
  LIVE_INIT_HEADERS,
  LIVE_PLAYLIST_HEADERS,
} from '../mime';

describe('packages/storage: mime header mapping', () => {
  it.each([
    ['master.m3u8', 'application/vnd.apple.mpegurl', 'public, max-age=60'],
    ['seg_00001.ts', 'video/MP2T', 'public, max-age=31536000, immutable'],
    ['poster.jpg', 'image/jpeg', 'public, max-age=31536000, immutable'],
    ['channels/c/avatar/v1/128.webp', 'image/webp', 'public, max-age=31536000, immutable'],
    ['sprite.vtt', 'text/vtt', 'public, max-age=31536000, immutable'],
    ['meta.json', 'application/json', 'public, max-age=60'],
    ['source.mp4', 'video/mp4', 'private, no-cache'],
    ['12.0.m4s', 'video/iso.segment', 'public, max-age=31536000, immutable'],
    ['unknown.bin', 'application/octet-stream', 'no-cache'],
    ['no-extension', 'application/octet-stream', 'no-cache'],
  ])('maps %s to %s', (filename, contentType, cacheControl) => {
    expect(getHeaderMapping(filename)).toEqual({ contentType, cacheControl });
  });

  it('reads the extension off the last segment of a full object key', () => {
    expect(getHeaderMapping('videos/018f.v2/hls/720p/index.m3u8').contentType).toBe(
      'application/vnd.apple.mpegurl'
    );
  });

  it('keeps an editable caption track fresh where the sprite track is immutable', () => {
    expect(CAPTIONS_TRACK_HEADERS).toEqual({
      contentType: 'text/vtt',
      cacheControl: 'public, max-age=60',
    });
  });

  it.each([
    {
      name: 'a live init segment public and immutable',
      headers: LIVE_INIT_HEADERS,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    {
      name: 'a live playlist out of every cache',
      headers: LIVE_PLAYLIST_HEADERS,
      cacheControl: 'no-cache',
    },
  ])('keeps $name', ({ headers, cacheControl }) => {
    expect(headers.cacheControl).toBe(cacheControl);
  });
});
