import type { OutboxStatus } from '@vp/domain';
import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';

/** `claimable_at` is the lease a relay's claim holds, then the backoff after a failed publish. */
export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    publishedAt: timestamptz('published_at'),
    attempts: integer('attempts').notNull().default(0),
    status: text('status').$type<OutboxStatus>().notNull().default('PENDING'),
    claimableAt: timestamptz('claimable_at'),
  },
  (table) => [index('outbox_drain_idx').on(table.status, table.createdAt)]
);
