import { CANONICAL_LADDER, LadderEntry, RENDITIONS } from '../ladder';

describe('@vp/job-contracts rendition ladder', () => {
  it('has one rung per rendition, in rendition order', () => {
    expect(CANONICAL_LADDER.map((rung) => rung.name)).toEqual(RENDITIONS);
  });

  it('orders the rungs by height, so the last one is the rung a short source keeps', () => {
    const heights = CANONICAL_LADDER.map((rung) => rung.height);

    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it.each(CANONICAL_LADDER)('holds $name to the job-contract schema', (rung) => {
    expect(LadderEntry.safeParse(rung).success).toBe(true);
  });
});
