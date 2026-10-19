import { bigserial, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users } from './schema';

export const userEvents = pgTable(
  'user_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('user_events_user_idx').on(table.userId, table.id),
    index('user_events_created_at_idx').on(table.createdAt),
  ]
);
