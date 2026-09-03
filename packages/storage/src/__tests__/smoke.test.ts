import { describe, expect, it } from 'vitest';
import {
  masterPlaylistKey,
  posterKey,
  rawSourceKey,
  renditionPlaylistKey,
  segmentKey,
  spriteKey,
  spriteVttKey,
} from '../keys.js';

describe('@vp/storage smoke test', () => {
  const videoId = '11111111-1111-7111-8111-111111111111';

  it('generates expected deterministic keys according to SDD §7', () => {
    expect(rawSourceKey(videoId, 'mp4')).toBe(`${videoId}/source.mp4`);
    expect(masterPlaylistKey(videoId)).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(renditionPlaylistKey(videoId, '720p')).toBe(`videos/${videoId}/hls/720p/index.m3u8`);
    expect(segmentKey(videoId, '720p', 1)).toBe(`videos/${videoId}/hls/720p/seg_00001.ts`);
    expect(segmentKey(videoId, '720p', 42)).toBe(`videos/${videoId}/hls/720p/seg_00042.ts`);
    expect(posterKey(videoId)).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(spriteKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(spriteVttKey(videoId)).toBe(`videos/${videoId}/thumbs/sprite.vtt`);
  });

  it('supports generation prefix for re-process runs', () => {
    expect(masterPlaylistKey(videoId, 2)).toBe(`videos/${videoId}/hls/g2/master.m3u8`);
    expect(segmentKey(videoId, '1080p', 5, 2)).toBe(`videos/${videoId}/hls/g2/1080p/seg_00005.ts`);
  });
});
