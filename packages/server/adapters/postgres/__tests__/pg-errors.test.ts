import { isForeignKeyViolation, isUniqueViolation } from '../pg-errors';

const DUPLICATE_MESSAGE = 'duplicate key value violates unique constraint "categories_slug_unique"';

describe('postgres adapter: constraint classification', () => {
  it('reads the SQLSTATE the postgres driver sets', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('walks the cause chain Drizzle wraps the driver error in', () => {
    expect(isUniqueViolation({ message: 'Failed query', cause: { code: '23505' } })).toBe(true);
  });

  it('falls back to the fixed Postgres wording for a driver that sets no SQLSTATE', () => {
    expect(isUniqueViolation({ message: 'Failed query', cause: { message: DUPLICATE_MESSAGE } })).toBe(
      true
    );
  });

  it.each([
    { name: 'a foreign key violation', error: { code: '23503' } },
    { name: 'a dead connection', error: { code: 'ECONNREFUSED' } },
    { name: 'a plain Error', error: new Error('boom') },
    { name: 'null', error: null },
    { name: 'undefined', error: undefined },
  ])('does not read $name as a unique violation', ({ error }) => {
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('classifies a foreign key violation by either signal', () => {
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true);
    expect(isForeignKeyViolation({ cause: { message: 'violates foreign key constraint' } })).toBe(
      true
    );
  });

  it('stops walking a cause chain that points at itself', () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;

    expect(isUniqueViolation(looping)).toBe(false);
  });
});
