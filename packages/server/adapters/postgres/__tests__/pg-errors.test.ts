import { isForeignKeyViolation, isUniqueViolation } from '../pg-errors';

const DUPLICATE_MESSAGE = 'duplicate key value violates unique constraint "categories_slug_unique"';

describe('postgres adapter: constraint classification', () => {
  it.each([
    { shape: 'the SQLSTATE the driver sets', error: { code: '23505' } },
    {
      shape: 'the cause chain Drizzle wraps the driver error in',
      error: { message: 'Failed query', cause: { code: '23505' } },
    },
  ])('reads a unique violation from $shape', ({ error }) => {
    expect(isUniqueViolation(error)).toBe(true);
  });

  it.each([
    { name: 'a foreign key violation', error: { code: '23503' } },
    { name: 'a dead connection', error: { code: 'ECONNREFUSED' } },
    { name: 'the Postgres wording with no SQLSTATE', error: { message: DUPLICATE_MESSAGE } },
    { name: 'a plain Error', error: new Error('boom') },
    { name: 'null', error: null },
    { name: 'undefined', error: undefined },
  ])('does not read $name as a unique violation', ({ error }) => {
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('reads a foreign key violation from its SQLSTATE', () => {
    expect(isForeignKeyViolation({ cause: { code: '23503' } })).toBe(true);
  });

  it('stops walking a cause chain that points at itself', () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;

    expect(isUniqueViolation(looping)).toBe(false);
  });
});
