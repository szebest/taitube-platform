import { FEATURED_VIDEOS_MAX } from '../featured-videos';

describe('@vp/domain: featured videos', () => {
  it('pins up to six videos', () => {
    expect(FEATURED_VIDEOS_MAX).toBe(6);
  });
});
