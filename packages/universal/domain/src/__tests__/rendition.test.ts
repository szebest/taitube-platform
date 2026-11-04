import { RENDITIONS, THUMBNAIL_PROGRESS } from '../rendition';

describe('domain: renditions', () => {
  it('lists the rungs tallest first', () => {
    const heights = RENDITIONS.map((name) => Number.parseInt(name, 10));

    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it('reports thumbnail progress under a key no rung shares', () => {
    expect(RENDITIONS).not.toContain(THUMBNAIL_PROGRESS);
  });
});
