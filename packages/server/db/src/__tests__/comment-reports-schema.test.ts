import { getTableConfig } from 'drizzle-orm/pg-core';
import { commentReports } from '../comment-reports-schema';
import { referenceFrom } from './foreign-key';

describe('db: comment reports schema', () => {
  it.each([
    {
      scenario: 'drops the reports of a removed comment',
      column: 'comment_id',
      table: 'video_comments',
    },
    { scenario: 'drops the reports of a deleted reporter', column: 'reporter_id', table: 'users' },
  ])('$scenario', ({ column, table }) => {
    expect(referenceFrom(commentReports, column)).toEqual({ table, onDelete: 'cascade' });
  });

  it('holds one report per reporter per comment', () => {
    const unique = getTableConfig(commentReports).indexes.find(
      (index) => index.config.name === 'comment_reports_one_per_reporter_idx'
    );

    expect(unique?.config.unique).toBe(true);
  });

  it.each(['comment_reports_reason_check', 'comment_reports_resolution_check'])(
    'guards the vocabulary with %s',
    (name) => {
      expect(getTableConfig(commentReports).checks.map((check) => check.name)).toContain(name);
    }
  );
});
