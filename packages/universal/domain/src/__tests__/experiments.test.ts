import {
  EXPERIMENT_MIN_IMPRESSIONS,
  type ExperimentVariantStats,
  experimentResults,
  mergeExperimentCounts,
  pickVariant,
  thumbnailSourcesOf,
} from '../experiments';

const TWO = [{ id: 'a' }, { id: 'b' }] as const;
const THREE = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const;
const SESSIONS = Array.from({ length: 600 }, (_, index) => `session-${index}`);

describe('@vp/domain: pickVariant', () => {
  it('gives one session the same variant every time', () => {
    const picks = Array.from({ length: 5 }, () => pickVariant('exp-1', 'session-7', TWO)?.id);
    expect(new Set(picks).size).toBe(1);
  });

  it.each([
    { name: 'two', variants: TWO },
    { name: 'three', variants: THREE },
  ])('spreads sessions over all $name variants', ({ variants }) => {
    const counts = new Map<string, number>();
    for (const session of SESSIONS) {
      const id = pickVariant('exp-1', session, variants)?.id ?? 'none';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const share = SESSIONS.length / variants.length;
    expect([...counts.keys()].sort()).toEqual(variants.map(({ id }) => id));
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(share * 0.8);
      expect(count).toBeLessThan(share * 1.2);
    }
  });

  it('picks nothing from no variants', () => {
    expect(pickVariant('exp-1', 'session-7', [])).toBeUndefined();
  });

  it('assigns a session independently in each experiment', () => {
    const differs = SESSIONS.some(
      (session) => pickVariant('exp-1', session, TWO)?.id !== pickVariant('exp-2', session, TWO)?.id
    );
    expect(differs).toBe(true);
  });
});

describe('@vp/domain: experimentResults', () => {
  const stats = (
    variantId: 'a' | 'b',
    impressions: number,
    starts: number,
    watchSeconds: number
  ): ExperimentVariantStats => ({ variantId, impressions, starts, watchSeconds });

  it('sums the days of each variant and reports the three ratios once each has the minimum', () => {
    const results = experimentResults(TWO, [
      stats('a', 600, 30, 900),
      stats('a', 400, 20, 600),
      stats('b', 1000, 100, 4000),
    ]);
    expect(results).toEqual({
      enoughData: true,
      variants: [
        {
          variantId: 'a',
          impressions: 1000,
          starts: 50,
          watchSeconds: 1500,
          watchSecondsPerImpression: 1.5,
          clickThrough: 0.05,
          averageViewSeconds: 30,
        },
        {
          variantId: 'b',
          impressions: 1000,
          starts: 100,
          watchSeconds: 4000,
          watchSecondsPerImpression: 4,
          clickThrough: 0.1,
          averageViewSeconds: 40,
        },
      ],
    });
  });

  it.each([
    { name: 'one variant short', a: EXPERIMENT_MIN_IMPRESSIONS, b: EXPERIMENT_MIN_IMPRESSIONS - 1 },
    { name: 'no data at all', a: 0, b: 0 },
  ])('withholds every ratio with $name', ({ a, b }) => {
    const results = experimentResults(TWO, [stats('a', a, 10, 100), stats('b', b, 10, 100)]);
    expect(results.enoughData).toBe(false);
    expect(
      results.variants.map(({ watchSecondsPerImpression, clickThrough, averageViewSeconds }) => [
        watchSecondsPerImpression,
        clickThrough,
        averageViewSeconds,
      ])
    ).toEqual([
      [null, null, null],
      [null, null, null],
    ]);
  });

  it('reports a variant without starts with no view duration', () => {
    const results = experimentResults(TWO, [stats('a', 1000, 0, 0), stats('b', 1000, 1, 5)]);
    expect(results.variants[0]?.averageViewSeconds).toBeNull();
  });
});

describe('@vp/domain: experiment counts', () => {
  it('adds the counts of one variant and day together', () => {
    const count = {
      experimentId: 'e1',
      variantId: 'a',
      viewDate: '2026-11-19',
      impressions: 1,
      starts: 0,
      watchSeconds: 0,
    } as const;
    expect(
      mergeExperimentCounts([
        count,
        { ...count, starts: 1, watchSeconds: 12 },
        { ...count, variantId: 'b' },
      ])
    ).toEqual([
      { ...count, impressions: 2, starts: 1, watchSeconds: 12 },
      { ...count, variantId: 'b' },
    ]);
  });

  it.each([
    { posterKey: 'videos/v/poster.jpg', expected: ['poster'] },
    { posterKey: null, expected: [] },
  ])('offers $expected as thumbnail sources', ({ posterKey, expected }) => {
    expect(thumbnailSourcesOf({ posterKey })).toEqual(expected);
  });
});
