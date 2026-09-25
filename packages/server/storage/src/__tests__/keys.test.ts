import { SEEDED } from '@vp/testing';
import {
  customThumbnailKey,
  masterPlaylistKey,
  posterKey,
  rawPrefix,
  rawSourceKey,
  renditionObjectKey,
  renditionPlaylistKey,
  renditionPrefix,
  reprocessPrefixesBefore,
  sanitizeStorageUrl,
  spriteKey,
  spriteVttKey,
  videoPrefix,
} from '../keys';

describe('packages/storage: object keys', () => {
  const videoId = SEEDED.videoId;
  const segmentKeyOf = (generation: number) =>
    renditionObjectKey(videoId, '720p', 'seg_00001.ts', generation);

  it('lays keys out as SDD §7 specifies', () => {
    expect(rawSourceKey(videoId, 'mp4')).toBe(`raw/${videoId}/source.mp4`);
    expect(rawSourceKey(videoId, '.mkv')).toBe(`raw/${videoId}/source.mkv`);
    expect(masterPlaylistKey(videoId)).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p')).toBe(`videos/${videoId}/hls/1080p/index.m3u8`);
    expect(posterKey(videoId)).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(spriteKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(spriteVttKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.vtt`);
  });

  it('keeps a custom thumbnail under the video it belongs to, named by its id', () => {
    expect(customThumbnailKey(videoId, 'thumb-1', 'png')).toBe(
      `videos/${videoId}/thumbs/custom/thumb-1.png`
    );
  });

  it('prefixes a reprocess generation into the playback keys', () => {
    expect(masterPlaylistKey(videoId, 2)).toBe(`videos/${videoId}/hls/g2/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p', 2)).toBe(
      `videos/${videoId}/hls/g2/1080p/index.m3u8`
    );
  });

  it('owns the prefixes a purge sweeps', () => {
    expect(rawPrefix(videoId)).toBe(`raw/${videoId}/`);
    expect(videoPrefix(videoId)).toBe(`videos/${videoId}/`);
    expect(renditionPrefix(videoId, '720p')).toBe(`videos/${videoId}/hls/720p/`);
    expect(renditionPrefix(videoId, '720p', 3)).toBe(`videos/${videoId}/hls/g3/720p/`);
  });

  it.each([
    [1, []],
    [2, []],
    [4, [`videos/${videoId}/hls/g2/`, `videos/${videoId}/hls/g3/`]],
  ])('lists the reprocess prefixes older than generation %i', (current, expected) => {
    expect(reprocessPrefixesBefore(videoId, current)).toEqual(expected);
  });

  it('holds every playback key a reprocess generation writes under its prefix', () => {
    const [prefix = ''] = reprocessPrefixesBefore(videoId, 3);

    expect(masterPlaylistKey(videoId, 2).startsWith(prefix)).toBe(true);
    expect(segmentKeyOf(2).startsWith(prefix)).toBe(true);
    expect(masterPlaylistKey(videoId, 3).startsWith(prefix)).toBe(false);
  });

  it('strips signature and credential params so a url is safe to log', () => {
    const signed =
      'http://localhost:9000/raw/018f/source.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin&X-Amz-Signature=abcd1234secret';

    expect(sanitizeStorageUrl(signed)).toBe('http://localhost:9000/raw/018f/source.mp4');
  });
});
