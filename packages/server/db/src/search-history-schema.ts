import { index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users } from './schema';

export const searchHistory = pgTable(
  'search_history',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    queryKey: text('query_key').notNull(),
    query: text('query').notNull(),
    searchedAt: timestamptz('searched_at').notNull(),
  },
  (table) => [
    unique('search_history_user_query_key').on(table.userId, table.queryKey),
    index('search_history_user_searched_idx').on(
      table.userId,
      table.searchedAt.desc(),
      table.id.desc()
    ),
    index('search_history_searched_at_idx').on(table.searchedAt),
  ]
);
