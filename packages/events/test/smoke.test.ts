import { describe, expect, it } from 'vitest';
import { VIDEO_WILDCARD_CHANNEL, userChannel, videoChannel } from '../src/index.js';

describe('@vp/events smoke test', () => {
  it('formats Redis channels correctly', () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    const userId = '22222222-2222-7222-8222-222222222222';
    expect(videoChannel(videoId)).toBe(`video:${videoId}`);
    expect(userChannel(userId)).toBe(`user:${userId}`);
    expect(VIDEO_WILDCARD_CHANNEL).toBe('video:*');
  });
});
