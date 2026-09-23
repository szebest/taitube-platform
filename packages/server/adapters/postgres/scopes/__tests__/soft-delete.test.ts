import { videos } from '@vp/db';
import { notDeletedScope } from '../soft-delete';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres/scoping: soft-delete scope', () => {
  it('combines both soft-delete columns when the table has them', () => {
    const scope = notDeletedScope(videos);
    expect(sqlText(scope)).toBe('("videos"."deleted_at" IS NULL and "videos"."status" <> $1)');
    expect(sqlParams(scope)).toEqual(['DELETED']);
  });

  it.each([
    {
      name: 'deletedAt only',
      table: { deletedAt: videos.deletedAt },
      sql: '"videos"."deleted_at" IS NULL',
    },
    { name: 'status only', table: { status: videos.status }, sql: '"videos"."status" <> $1' },
  ])('emits just the available condition given $name', ({ table, sql }) => {
    expect(sqlText(notDeletedScope(table))).toBe(sql);
  });

  it('returns undefined for a table with no soft-delete columns', () => {
    expect(notDeletedScope({})).toBeUndefined();
  });
});
