import * as schema from '@vp/db';
import { sql } from 'drizzle-orm';
import { aliasedTable } from '../aliased-table';
import { sqlText } from './sql-text';

describe('adapters/postgres: aliasedTable', () => {
  it('prints the base table once, under its alias, and qualifies the columns with the alias', () => {
    const { table, from } = aliasedTable(schema.videoComments, 'parent');

    expect(sqlText(sql`select 1 from ${from} where ${table.id} is not null`)).toBe(
      'select 1 from "video_comments" as "parent" where "parent"."id" is not null'
    );
  });
});
