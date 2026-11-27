import { longestRun, voteOffset } from '../offset-vote';

const pairs = (offset: number, queryIdxs: number[]) =>
  queryIdxs.map((queryIdx) => ({ queryIdx, matchIdx: queryIdx + offset }));

describe('@vp/fingerprint: voteOffset', () => {
  it.each([
    { name: 'no pairs', given: [], offset: null, voters: [] },
    { name: 'an exact copy', given: pairs(0, [0, 1, 2, 3]), offset: 0, voters: [0, 1, 2, 3] },
    { name: 'a trimmed start', given: pairs(10, [0, 1, 2]), offset: 10, voters: [0, 1, 2] },
    {
      name: 'a new video starting inside the old',
      given: pairs(-4, [4, 5, 6]),
      offset: -4,
      voters: [4, 5, 6],
    },
    {
      name: 'a shifted copy among stray matches',
      given: [...pairs(7, [0, 1, 2, 3, 4]), ...pairs(30, [2]), ...pairs(-12, [5])],
      offset: 7,
      voters: [0, 1, 2, 3, 4],
    },
    {
      name: 'a drifting copy, one sample off now and then',
      given: [...pairs(7, [0, 1, 2]), ...pairs(8, [3, 4]), ...pairs(6, [5])],
      offset: 7,
      voters: [0, 1, 2, 3, 4, 5],
    },
    {
      name: 'a query frame matching two stored ones, counted once',
      given: [...pairs(3, [0, 1]), ...pairs(3, [0, 1]), { queryIdx: 0, matchIdx: 3 }],
      offset: 3,
      voters: [0, 1],
    },
    {
      name: 'a tie, which goes to the smaller offset',
      given: [...pairs(9, [0, 1]), ...pairs(2, [5, 6])],
      offset: 2,
      voters: [5, 6],
    },
  ])('picks $offset for $name', ({ given, offset, voters }) => {
    const vote = voteOffset(given);

    expect(vote?.offset ?? null).toBe(offset);
    expect(vote?.queryIdxs ?? []).toEqual(voters);
  });

  it('does not depend on the order of the pairs', () => {
    const given = [...pairs(5, [0, 1, 2, 3]), ...pairs(20, [1, 2])];

    expect(voteOffset([...given].reverse())).toEqual(voteOffset(given));
  });
});

describe('@vp/fingerprint: longestRun', () => {
  it.each([
    { name: 'nothing', idxs: [], run: null },
    { name: 'one sample', idxs: [4], run: { startIdx: 4, endIdx: 4, length: 1 } },
    { name: 'consecutive samples', idxs: [2, 3, 4, 5], run: { startIdx: 2, endIdx: 5, length: 4 } },
    {
      name: 'a single miss inside',
      idxs: [2, 3, 5, 6],
      run: { startIdx: 2, endIdx: 6, length: 5 },
    },
    {
      name: 'two misses, which split it',
      idxs: [0, 1, 4, 5, 6],
      run: { startIdx: 4, endIdx: 6, length: 3 },
    },
    {
      name: 'the first of two equal runs',
      idxs: [0, 1, 10, 11],
      run: { startIdx: 0, endIdx: 1, length: 2 },
    },
  ])('finds $name', ({ idxs, run }) => {
    expect(longestRun(idxs)).toEqual(run);
  });
});
