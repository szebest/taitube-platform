import { videoIdsOf } from '../in-memory-channel-page-rows';

describe('videoIdsOf', () => {
  it('keeps the videos of a playlist in order and skips its sections', () => {
    expect(
      videoIdsOf([
        { kind: 'video', videoId: 'a' },
        { kind: 'section', videoId: null },
        { kind: 'video', videoId: 'b' },
      ])
    ).toEqual(['a', 'b']);
  });
});
