import { FEATURED_SOURCES, FEATURED_VIDEOS_MAX } from '../featured-videos';

describe('@vp/domain: featured videos', () => {
  it('pins up to six videos', () => {
    expect(FEATURED_VIDEOS_MAX).toBe(6);
  });

  it('shows either what the creator pinned or the most viewed', () => {
    expect(FEATURED_SOURCES).toEqual(['pinned', 'popular']);
  });
});
