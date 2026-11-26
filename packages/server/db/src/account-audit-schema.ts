import type { AccountAuditAction, AccountAuditMeta } from '@vp/domain';
import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users } from './schema';

export const accountAuditLog = pgTable(
  'account_audit_log',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action').$type<AccountAuditAction>().notNull(),
    meta: jsonb('meta').$type<AccountAuditMeta>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('account_audit_log_user_newest_idx').on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc()
    ),
  ]
);
