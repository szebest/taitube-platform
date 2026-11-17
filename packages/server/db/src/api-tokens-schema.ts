import { API_SCOPES, API_TOKEN_LIMITS, type ApiScope } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { channels, users } from './schema';

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    secretHash: text('secret_hash').notNull(),
    scopes: text('scopes').array().$type<ApiScope[]>().notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    index('api_tokens_prefix_idx').on(table.prefix),
    index('api_tokens_user_newest_idx')
      .on(table.userId, table.createdAt.desc())
      .where(sql`${table.revokedAt} IS NULL`),
    check(
      'api_tokens_name_check',
      sql`char_length(${table.name}) BETWEEN 1 AND ${sql.raw(String(API_TOKEN_LIMITS.nameMaxLength))}`
    ),
    check('api_tokens_prefix_check', sql`${table.prefix} ~ '^[0-9a-f]{8}$'`),
    check(
      'api_tokens_scopes_check',
      sql`cardinality(${table.scopes}) >= 1 AND ${table.scopes} <@ ARRAY[${listOf(API_SCOPES)}]::text[]`
    ),
  ]
);

/** One row per token and UTC day it was used on; the count is what the developer page shows. */
export const apiTokenUsage = pgTable(
  'api_token_usage',
  {
    tokenId: uuid('token_id')
      .notNull()
      .references(() => apiTokens.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    requests: integer('requests').notNull(),
  },
  (table) => [primaryKey({ columns: [table.tokenId, table.day] })]
);
