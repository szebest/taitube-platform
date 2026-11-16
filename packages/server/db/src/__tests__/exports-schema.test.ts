import { getTableConfig } from 'drizzle-orm/pg-core';
import { dataExports } from '../exports-schema';
import { referenceFrom } from './foreign-key';

describe('db: exports schema', () => {
  it.each([
    { column: 'channel_id', expected: { table: 'channels', onDelete: 'cascade' } },
    { column: 'requested_by', expected: { table: 'users', onDelete: 'set null' } },
  ])('references $expected.table from $column', ({ column, expected }) => {
    expect(referenceFrom(dataExports, column)).toEqual(expected);
  });

  it('guards the kind, format and status vocabularies in the database', () => {
    expect(
      getTableConfig(dataExports)
        .checks.map((constraint) => constraint.name)
        .sort()
    ).toEqual([
      'data_exports_format_check',
      'data_exports_kind_check',
      'data_exports_status_check',
    ]);
  });

  it('holds one unsettled export per channel, lists newest first and finds the files to purge', () => {
    expect(getTableConfig(dataExports).indexes.map((index) => index.config.name)).toEqual([
      'data_exports_one_active_idx',
      'data_exports_channel_newest_idx',
      'data_exports_ready_expiry_idx',
    ]);
  });
});
