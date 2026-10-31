import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { PICK_NOTE_MAX_LENGTH } from '@vp/validation';
import { timestamptz } from './columns';
import { users, videos } from './schema';

export const picks = pgTable(
  'picks',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    index('picks_starts_at_idx').on(table.startsAt),
    index('picks_video_idx').on(table.videoId),
    check('picks_window_check', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'picks_note_check',
      sql`${table.note} IS NULL OR char_length(${table.note}) BETWEEN 1 AND ${sql.raw(String(PICK_NOTE_MAX_LENGTH))}`
    ),
  ]
);
