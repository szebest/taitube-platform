import { JsonCursorCodec } from '../cursor-codec';
import { DEFAULT_PAGINATION, Paginator, defaultPaginator } from '../pagination';

describe('packages/pagination: Paginator', () => {
  const jsonPaginator = new Paginator({ cursorCodec: new JsonCursorCodec() });
  const cursorOf = (row: { id: string }) => ({ id: row.id });
  const toItem = (row: { id: string }) => row.id;
  const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `r${i}` }));

  describe('limit', () => {
    it.each([
      { scenario: 'omitted', requested: undefined, expected: 20 },
      { scenario: 'within bounds', requested: 35, expected: 35 },
      { scenario: 'above the maximum', requested: 5000, expected: 100 },
      { scenario: 'zero', requested: 0, expected: 1 },
      { scenario: 'negative', requested: -10, expected: 1 },
      { scenario: 'fractional', requested: 12.9, expected: 12 },
      { scenario: 'not a number', requested: Number.NaN, expected: 20 },
    ])('resolves a $scenario limit to $expected', ({ requested, expected }) => {
      expect(defaultPaginator.limit(requested)).toBe(expected);
    });

    it('honours configured overrides', () => {
      const paginator = new Paginator({ defaultLimit: 5, maxLimit: 10 });

      expect(paginator.limit()).toBe(5);
      expect(paginator.limit(50)).toBe(10);
    });

    it('falls back per field when an override is partial', () => {
      const paginator = new Paginator({ maxLimit: 10 });

      expect(paginator.limit()).toBe(DEFAULT_PAGINATION.defaultLimit);
      expect(paginator.limit(50)).toBe(10);
    });
  });

  it('asks for one row beyond the page', () => {
    expect(defaultPaginator.window(20)).toBe(21);
  });

  describe('paginate', () => {
    it('trims the probe row and mints a cursor from the last visible row', () => {
      const page = jsonPaginator.paginate(rows(3), 2, { cursorOf, toItem });

      expect(page).toEqual({ items: ['r0', 'r1'], nextCursor: '{"id":"r1"}' });
    });

    it.each([
      { scenario: 'the window did not fill', available: 2, limit: 5 },
      { scenario: 'the window fills exactly', available: 2, limit: 2 },
    ])('returns no cursor when $scenario', ({ available, limit }) => {
      const page = jsonPaginator.paginate(rows(available), limit, { cursorOf, toItem });

      expect(page).toEqual({ items: ['r0', 'r1'], nextCursor: null });
    });

    it('handles an empty result', () => {
      const page = jsonPaginator.paginate([], 10, { cursorOf, toItem });

      expect(page).toEqual({ items: [], nextCursor: null });
    });

    it('round-trips its own cursor through the configured codec', () => {
      const page = defaultPaginator.paginate(rows(3), 2, { cursorOf, toItem });

      expect(defaultPaginator.decodeCursor(page.nextCursor)).toEqual({ id: 'r1' });
    });
  });

  describe('decodeCursor', () => {
    it('treats an absent cursor as the first page', () => {
      expect(defaultPaginator.decodeCursor(undefined)).toBeNull();
      expect(defaultPaginator.decodeCursor(null)).toBeNull();
      expect(defaultPaginator.decodeCursor('')).toBeNull();
    });
  });

  it('swaps the cursor wire format without changing any call site', () => {
    const rows3 = rows(3);

    expect(jsonPaginator.paginate(rows3, 2, { cursorOf, toItem }).nextCursor).toBe('{"id":"r1"}');
    expect(defaultPaginator.paginate(rows3, 2, { cursorOf, toItem }).nextCursor).not.toBe(
      '{"id":"r1"}'
    );
  });
});
