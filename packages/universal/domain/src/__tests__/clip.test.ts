import { CLIP_MAX_MS, CLIP_MIN_MS } from '../clip';

describe('@vp/domain: clip bounds', () => {
  it('allows a clip from five to sixty seconds', () => {
    expect([CLIP_MIN_MS, CLIP_MAX_MS]).toEqual([5_000, 60_000]);
  });
});
