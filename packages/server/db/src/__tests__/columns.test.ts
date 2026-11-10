import { PgDialect, pgTable } from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from '../columns';

describe('db: columns', () => {
  it('declares a timezone-aware timestamp read back as a Date', () => {
    const { at } = pgTable('probe', { at: timestamptz('at') });

    expect(at.getSQLType()).toBe('timestamp with time zone');
    expect(at.dataType).toBe('date');
  });

  it.each([
    { values: ['a', 'b'], sql: "'a', 'b'" },
    { values: ['only'], sql: "'only'" },
  ])('lists $values as $sql', ({ values, sql }) => {
    expect(new PgDialect().sqlToQuery(listOf(values)).sql).toBe(sql);
  });
});
