import { CAPTIONS_TRACK_HEADERS, getHeaderMapping } from '../mime';

describe('packages/storage: mime header mapping', () => {
  it.each([
    ['master.m3u8', 'application/vnd.apple.mpegurl', 'public, max-age=60'],
    ['seg_00001.ts', 'video/MP2T', 'public, max-age=31536000, immutable'],
    ['poster.jpg', 'image/jpeg', 'public, max-age=31536000, immutable'],
    ['sprite.vtt', 'text/vtt', 'public, max-age=31536000, immutable'],
    ['meta.json', 'application/json', 'public, max-age=60'],
    ['source.mp4', 'video/mp4', 'private, no-cache'],
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
});
