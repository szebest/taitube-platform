import { LadderEntry } from '../index';
import { CANONICAL_LADDER, RENDITIONS } from '../ladder';

describe('@vp/job-contracts rendition ladder', () => {
  it('names the renditions from the ladder, tallest first', () => {
    expect(RENDITIONS).toEqual(['1080p', '720p', '480p']);
  });

  it('orders the rungs by height, so the last one is the rung a short source keeps', () => {
    const heights = CANONICAL_LADDER.map((rung) => rung.height);

    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it.each(CANONICAL_LADDER)('holds $name to the job-contract schema', (rung) => {
    expect(LadderEntry.safeParse(rung).success).toBe(true);
  });
});
