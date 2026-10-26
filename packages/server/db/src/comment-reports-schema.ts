import { COMMENT_REPORT_REASONS, COMMENT_REPORT_RESOLUTIONS } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { videoComments } from './comments-schema';
import { users } from './schema';

const quoted = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

export const commentReports = pgTable(
  'comment_reports',
  {
    id: uuid('id').primaryKey(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => videoComments.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason', { enum: COMMENT_REPORT_REASONS }).notNull(),
    note: text('note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    resolvedAt: timestamptz('resolved_at'),
    resolution: text('resolution', { enum: COMMENT_REPORT_RESOLUTIONS }),
  },
  (table) => [
    uniqueIndex('comment_reports_one_per_reporter_idx').on(table.commentId, table.reporterId),
    index('comment_reports_open_comment_idx')
      .on(table.commentId)
      .where(sql`${table.resolvedAt} IS NULL`),
    index('comment_reports_queue_idx').on(
      sql`(${table.resolvedAt} IS NULL) DESC`,
      table.createdAt.desc(),
      table.id.desc()
    ),
    check(
      'comment_reports_reason_check',
      sql`${table.reason} IN (${quoted(COMMENT_REPORT_REASONS)})`
    ),
    check(
      'comment_reports_resolution_check',
      sql`(${table.resolvedAt} IS NULL) = (${table.resolution} IS NULL) AND (${table.resolution} IS NULL OR ${table.resolution} IN (${quoted(COMMENT_REPORT_RESOLUTIONS)}))`
    ),
  ]
);
