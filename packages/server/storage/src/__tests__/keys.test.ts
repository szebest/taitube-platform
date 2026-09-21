import { FIXTURES } from '@vp/testing';
import {
  masterPlaylistKey,
  metaKey,
  posterKey,
  rawSourceKey,
  renditionPlaylistKey,
  sanitizeStorageUrl,
  segmentKey,
  spriteKey,
  spriteVttKey,
} from '../keys';

describe('packages/storage: object keys', () => {
  const videoId = FIXTURES.VIDEO_ID;

  it('lays keys out as SDD §7 specifies', () => {
    expect(rawSourceKey(videoId, 'mp4')).toBe(`raw/${videoId}/source.mp4`);
    expect(rawSourceKey(videoId, '.mkv')).toBe(`raw/${videoId}/source.mkv`);
    expect(masterPlaylistKey(videoId)).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p')).toBe(`videos/${videoId}/hls/1080p/index.m3u8`);
    expect(segmentKey(videoId, '720p', 1)).toBe(`videos/${videoId}/hls/720p/seg_00001.ts`);
    expect(segmentKey(videoId, '720p', 99)).toBe(`videos/${videoId}/hls/720p/seg_00099.ts`);
    expect(posterKey(videoId)).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(spriteKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(spriteVttKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.vtt`);
    expect(metaKey(videoId)).toBe(`videos/${videoId}/meta.json`);
  });

  it('prefixes a reprocess generation into the playback keys', () => {
    expect(masterPlaylistKey(videoId, 2)).toBe(`videos/${videoId}/hls/g2/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '1080p', 2)).toBe(
      `videos/${videoId}/hls/g2/1080p/index.m3u8`
    );
    expect(segmentKey(videoId, '1080p', 5, 2)).toBe(`videos/${videoId}/hls/g2/1080p/seg_00005.ts`);
  });

  it('strips signature and credential params so a url is safe to log', () => {
    const signed =
      'http://localhost:9000/raw/018f/source.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin&X-Amz-Signature=abcd1234secret';

    expect(sanitizeStorageUrl(signed)).toBe('http://localhost:9000/raw/018f/source.mp4');
  });
});
