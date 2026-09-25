import { pgTable } from 'drizzle-orm/pg-core';
import { timestamptz } from '../columns';

describe('db: columns', () => {
  it('declares a timezone-aware timestamp read back as a Date', () => {
    const { at } = pgTable('probe', { at: timestamptz('at') });

    expect(at.getSQLType()).toBe('timestamp with time zone');
    expect(at.dataType).toBe('date');
  });
});
