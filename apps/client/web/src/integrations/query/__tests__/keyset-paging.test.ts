import { keysetPaging } from '../keyset-paging';

describe('apps/client/web: keysetPaging', () => {
  it('starts a feed without a cursor', () => {
    expect(keysetPaging.initialPageParam).toBeUndefined();
  });

  it.each([
    { page: 'a page with a cursor', nextCursor: 'next', param: 'next' },
    { page: 'the last page', nextCursor: null, param: undefined },
  ])('asks for $page with $param next', ({ nextCursor, param }) => {
    expect(keysetPaging.getNextPageParam({ nextCursor })).toBe(param);
  });
});
