import { retentionCells } from '../retention-cells';

describe('apps/client/studio: retentionCells', () => {
  it('colours each point by how many viewers reached it, between the fewest and the most', () => {
    const cells = retentionCells([
      { percent: 0, viewers: 100 },
      { percent: 50, viewers: 50 },
      { percent: 100, viewers: 0 },
    ]);

    expect(cells).toEqual([
      { percent: 0, viewers: 100, fill: 'var(--dataviz-sequential-5)' },
      { percent: 50, viewers: 50, fill: 'var(--dataviz-sequential-3)' },
      { percent: 100, viewers: 0, fill: 'var(--dataviz-sequential-1)' },
    ]);
  });

  it('puts a flat curve on the lowest step', () => {
    expect(
      retentionCells([
        { percent: 0, viewers: 7 },
        { percent: 5, viewers: 7 },
      ]).map(({ fill }) => fill)
    ).toEqual(['var(--dataviz-sequential-1)', 'var(--dataviz-sequential-1)']);
  });

  it('has nothing to colour for an empty curve', () => {
    expect(retentionCells([])).toEqual([]);
  });
});
