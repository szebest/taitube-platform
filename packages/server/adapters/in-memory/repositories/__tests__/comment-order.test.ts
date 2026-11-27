import { commentSortKey, compareKeys, rowKey, threadPage } from '../comment-order';

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

  it('keys a row by when it was written, then its id', () => {
    expect(rowKey(ROW)).toEqual([ROW.createdAt.getTime(), 'c1']);
  });

  it.each([
    { a: [1, 'b'], b: [1, 'a'], order: 1 },
    { a: [0, 'z'], b: [1, 'a'], order: -1 },
    { a: [1, 'a'], b: [1, 'a'], order: 0 },
  ])('compares $a with $b as $order', ({ a, b, order }) => {
    expect(compareKeys(a, b)).toBe(order);
  });

  describe('threadPage', () => {
    const rows = ['c4', 'c3', 'c2', 'c1'].map((id, i) => ({
      ...ROW,
      id,
      createdAt: new Date(ROW.createdAt.getTime() - i * 1000),
    }));
    const ids = (page: readonly { id: string }[]) => page.map((row) => row.id);

    it.each([
      {
        name: 'the first keyset page, one row past the limit',
        window: { type: 'keyset' as const, cursor: null, limit: 2 },
        expected: ['c4', 'c3', 'c2'],
      },
      {
        name: 'a keyset page after a cursor',
        window: { type: 'keyset' as const, cursor: rows[1] ?? ROW, limit: 2 },
        expected: ['c2', 'c1'],
      },
      {
        name: 'an offset page',
        window: { type: 'offset' as const, offset: 1, limit: 1 },
        expected: ['c3', 'c2'],
      },
    ])('serves $name', ({ window, expected }) => {
      expect(ids(threadPage(rows, 'newest', window))).toEqual(expected);
    });
  });
});
