import { commentSortKey, compareKeys } from '../comment-order';

const ROW = {
  id: 'c1',
  isPinned: false,
  likeCount: 3,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('@vp/adapters/in-memory: comment order', () => {
  it.each([
    { sort: 'top', key: [0, 3, ROW.createdAt.getTime(), 'c1'] },
    { sort: 'newest', key: [0, ROW.createdAt.getTime(), 'c1'] },
  ] as const)('keys a $sort listing pinned first', ({ sort, key }) => {
    expect(commentSortKey(sort, ROW)).toEqual(key);
    expect(commentSortKey(sort, { ...ROW, isPinned: true })[0]).toBe(1);
  });

  it.each([
    { a: [1, 'b'], b: [1, 'a'], order: 1 },
    { a: [0, 'z'], b: [1, 'a'], order: -1 },
    { a: [1, 'a'], b: [1, 'a'], order: 0 },
  ])('compares $a with $b as $order', ({ a, b, order }) => {
    expect(compareKeys(a, b)).toBe(order);
  });
});
