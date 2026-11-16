import { getTableConfig } from 'drizzle-orm/pg-core';
import { outbox } from '../outbox-schema';

describe('db: outbox schema', () => {
  it('starts a row PENDING and drains the pending rows oldest first', () => {
    const { columns, indexes } = getTableConfig(outbox);

    expect(columns.find((column) => column.name === 'status')?.default).toBe('PENDING');
    expect(
      indexes.map((index) => [
        index.config.name,
        index.config.columns.map((column) => Reflect.get(column, 'name')),
      ])
    ).toEqual([['outbox_drain_idx', ['status', 'created_at']]]);
  });
});
