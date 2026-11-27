import { LAYOUT_SCHEDULE_STATUSES, type LayoutScheduleStatus, type StoredLayout } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { channels, users } from './schema';

export const channelLayoutDrafts = pgTable(
  'channel_layout_drafts',
  {
    channelId: uuid('channel_id')
      .primaryKey()
      .references(() => channels.id, { onDelete: 'cascade' }),
    doc: jsonb('doc').$type<StoredLayout>().notNull(),
    version: integer('version').notNull().default(1),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [check('channel_layout_drafts_version_check', sql`${table.version} >= 1`)]
);

export const channelLayoutSchedules = pgTable(
  'channel_layout_schedules',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    doc: jsonb('doc').$type<StoredLayout>().notNull(),
    publishAt: timestamptz('publish_at').notNull(),
    status: text('status').$type<LayoutScheduleStatus>().notNull().default('pending'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('channel_layout_schedules_channel_status_idx').on(table.channelId, table.status),
    index('channel_layout_schedules_due_idx')
      .on(table.publishAt)
      .where(sql`${table.status} = 'pending'`),
    check(
      'channel_layout_schedules_status_check',
      sql`${table.status} IN (${listOf(LAYOUT_SCHEDULE_STATUSES)})`
    ),
  ]
);
