import { describe, expect, it } from 'vitest';
import { DEFAULT_LADDER } from '../src/index.js';

describe('@vp/ffmpeg smoke test', () => {
  it('defines default HLS ladder with 1080p, 720p, 480p renditions', () => {
    expect(DEFAULT_LADDER).toHaveLength(3);
    expect(DEFAULT_LADDER[0]?.name).toBe('1080p');
    expect(DEFAULT_LADDER[1]?.name).toBe('720p');
    expect(DEFAULT_LADDER[2]?.name).toBe('480p');
  });
});
