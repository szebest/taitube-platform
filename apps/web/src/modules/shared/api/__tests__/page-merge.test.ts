import { appendPage } from '../page-merge';

describe('apps/web: keyset page merge', () => {
  it('appends the next page and carries its cursor forward', () => {
    const cache: { items: string[]; nextCursor: string | null } = { items: ['a'], nextCursor: 'c1' };

    appendPage(cache, { items: ['b', 'c'], nextCursor: 'c2' });

    expect(cache).toEqual({ items: ['a', 'b', 'c'], nextCursor: 'c2' });
  });

  it('clears the cursor once the last page arrives', () => {
    const cache: { items: string[]; nextCursor: string | null } = { items: ['a'], nextCursor: 'c1' };

    appendPage(cache, { items: [], nextCursor: null });

    expect(cache.nextCursor).toBeNull();
  });

  it('refreshes the total when the payload carries one', () => {
    const cache: { items: string[]; nextCursor: string | null; total: number } = {
      items: [],
      nextCursor: 'c1',
      total: 1,
    };

    appendPage(cache, { items: ['a'], nextCursor: null, total: 9 });

    expect(cache.total).toBe(9);
  });
});
