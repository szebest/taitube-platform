import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { WEBHOOK_EVENTS, type WebhookEvent } from '@vp/domain';
import { WEBHOOK_URL_MAX_LENGTH } from '@vp/validation';
import { timestamptz } from './columns';
import { users } from './schema';

const EVENT_LIST = sql.raw(WEBHOOK_EVENTS.map((event) => `'${event}'`).join(', '));

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    events: text('events').array().$type<WebhookEvent[]>().notNull(),
    secret: text('secret').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    index('webhooks_owner_created_idx').on(table.ownerId, table.createdAt),
    check(
      'webhooks_url_check',
      sql`char_length(${table.url}) BETWEEN 1 AND ${sql.raw(String(WEBHOOK_URL_MAX_LENGTH))}`
    ),
    check(
      'webhooks_events_check',
      sql`cardinality(${table.events}) >= 1 AND ${table.events} <@ ARRAY[${EVENT_LIST}]::text[]`
    ),
  ]
);
