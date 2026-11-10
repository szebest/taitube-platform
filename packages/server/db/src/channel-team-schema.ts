import {
  CHANNEL_INVITE_STATUSES,
  CHANNEL_ROLE_NAMES,
  type ChannelAuditAction,
  type ChannelInviteStatus,
  type ChannelRole,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { channels, users } from './schema';

export const channelMembers = pgTable(
  'channel_members',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<ChannelRole>().notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.channelId, table.userId] }),
    index('channel_members_user_idx').on(table.userId),
    check('channel_members_role_check', sql`${table.role} IN (${listOf(CHANNEL_ROLE_NAMES)})`),
  ]
);

export const channelInvites = pgTable(
  'channel_invites',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    inviteeUserId: uuid('invitee_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<ChannelRole>().notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').$type<ChannelInviteStatus>().notNull().default('pending'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (table) => [
    uniqueIndex('channel_invites_one_pending_idx')
      .on(table.channelId, table.inviteeUserId)
      .where(sql`${table.status} = 'pending'`),
    index('channel_invites_invitee_pending_idx')
      .on(table.inviteeUserId)
      .where(sql`${table.status} = 'pending'`),
    check('channel_invites_role_check', sql`${table.role} IN (${listOf(CHANNEL_ROLE_NAMES)})`),
    check(
      'channel_invites_status_check',
      sql`${table.status} IN (${listOf(CHANNEL_INVITE_STATUSES)})`
    ),
  ]
);

/** Append-only. `action` and `target_type` carry no CHECK, so a new action needs no migration. */
export const channelAuditLog = pgTable(
  'channel_audit_log',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').$type<ChannelAuditAction>().notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('channel_audit_log_channel_newest_idx').on(
      table.channelId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('channel_audit_log_created_at_idx').on(table.createdAt),
  ]
);
