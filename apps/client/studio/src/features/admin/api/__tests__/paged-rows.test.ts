import { pagedRows, tableStateOf } from '../paged-rows';

describe('apps/client/studio: pagedRows', () => {
  it('flattens every loaded page in order', () => {
    expect(pagedRows({ pages: [{ items: [1, 2] }, { items: [] }, { items: [3] }] })).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('apps/client/studio: tableStateOf', () => {
  it.each([
    { scenario: 'pending', query: { isPending: true, isError: false }, rows: 0, state: 'loading' },
    { scenario: 'failed with no rows', query: { isPending: false, isError: true }, rows: 0, state: 'error' },
    { scenario: 'failed after rows loaded', query: { isPending: false, isError: true }, rows: 2, state: 'ready' },
    { scenario: 'answered with no rows', query: { isPending: false, isError: false }, rows: 0, state: 'empty' },
    { scenario: 'answered with rows', query: { isPending: false, isError: false }, rows: 2, state: 'ready' },
  ])('is $state when $scenario', ({ query, rows, state }) => {
    expect(tableStateOf(query, rows)).toBe(state);
  });
});
