import {
  DATA_EXPORT_EDGES,
  DATA_EXPORT_FORMATS,
  DATA_EXPORT_KINDS,
  DATA_EXPORT_STATUSES,
  type DataExportFormat,
  type DataExportKind,
  type DataExportParams,
  type DataExportStatus,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { channels, users } from './schema';

/** Queued or running: the statuses a job can still fail from, of which a channel holds one at a time. */
const UNSETTLED = DATA_EXPORT_EDGES.fail.from;

export const dataExports = pgTable(
  'data_exports',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').$type<DataExportKind>().notNull(),
    params: jsonb('params').$type<DataExportParams>().notNull().default({}),
    format: text('format').$type<DataExportFormat>().notNull(),
    status: text('status').$type<DataExportStatus>().notNull().default('queued'),
    objectKey: text('object_key'),
    rowCount: integer('row_count'),
    failure: text('failure'),
    expiresAt: timestamptz('expires_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('data_exports_one_active_idx')
      .on(table.channelId)
      .where(sql`${table.status} IN (${listOf(UNSETTLED)})`),
    index('data_exports_channel_newest_idx').on(
      table.channelId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('data_exports_ready_expiry_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'ready'`),
    check('data_exports_kind_check', sql`${table.kind} IN (${listOf(DATA_EXPORT_KINDS)})`),
    check('data_exports_format_check', sql`${table.format} IN (${listOf(DATA_EXPORT_FORMATS)})`),
    check('data_exports_status_check', sql`${table.status} IN (${listOf(DATA_EXPORT_STATUSES)})`),
  ]
);
