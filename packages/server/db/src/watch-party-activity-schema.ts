import type {
  WatchPartyInviteStatus,
  WatchPartyMessageSource,
  WatchPartySystemLine,
  WatchingSnapshot,
} from '@vp/domain';
import { CHAT_MESSAGE_BOUNDS } from '@vp/validation';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users, videos } from './schema';
import { watchPartyRooms } from './watch-parties-schema';

const roomId = () =>
  uuid('room_id')
    .notNull()
    .references(() => watchPartyRooms.id, { onDelete: 'cascade' });

export const watchPartyInvites = pgTable(
  'watch_party_invites',
  {
    id: uuid('id').primaryKey(),
    roomId: roomId(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').$type<WatchPartyInviteStatus>().notNull().default('pending'),
    watching: jsonb('watching').$type<WatchingSnapshot>().notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('watch_party_invites_room_invitee_key').on(table.roomId, table.inviteeId),
    index('watch_party_invites_inviter_created_idx').on(table.inviterId, table.createdAt),
  ]
);

export const watchPartyInviteLinks = pgTable(
  'watch_party_invite_links',
  {
    id: uuid('id').primaryKey(),
    roomId: roomId(),
    createdBy: text('created_by').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    maxUses: integer('max_uses'),
    uses: integer('uses').notNull().default(0),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [index('watch_party_invite_links_room_idx').on(table.roomId)]
);

export const watchPartyQueueItems = pgTable(
  'watch_party_queue_items',
  {
    id: uuid('id').primaryKey(),
    roomId: roomId(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    addedBy: text('added_by').notNull(),
    position: integer('position').notNull(),
    startMs: integer('start_ms').notNull().default(0),
    playedAt: timestamptz('played_at'),
    removedAt: timestamptz('removed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('watch_party_queue_items_room_position_idx')
      .on(table.roomId, table.position)
      .where(sql`${table.removedAt} IS NULL`),
    index('watch_party_queue_items_video_idx').on(table.videoId),
  ]
);

export const watchPartyMessages = pgTable(
  'watch_party_messages',
  {
    id: uuid('id').primaryKey(),
    roomId: roomId(),
    authorKey: text('author_key'),
    source: text('source').$type<WatchPartyMessageSource>().notNull().default('app'),
    kind: text('kind').$type<'text' | 'system'>().notNull(),
    body: text('body').notNull(),
    system: jsonb('system').$type<WatchPartySystemLine>(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
    positionMs: integer('position_ms'),
    pinned: boolean('pinned').notNull().default(false),
    removedAt: timestamptz('removed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('watch_party_messages_room_id_idx').on(table.roomId, table.id),
    uniqueIndex('watch_party_messages_one_pinned')
      .on(table.roomId)
      .where(sql`${table.pinned}`),
    index('watch_party_messages_created_at_idx').on(table.createdAt),
    check(
      'watch_party_messages_length_check',
      sql`${table.kind} = 'system' OR char_length(${table.body}) BETWEEN ${sql.raw(String(CHAT_MESSAGE_BOUNDS.minLength))} AND ${sql.raw(String(CHAT_MESSAGE_BOUNDS.maxLength))}`
    ),
  ]
);

export const watchPartyPersonalControls = pgTable(
  'watch_party_personal_controls',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetKey: text('target_key').notNull(),
    roomId: uuid('room_id').references(() => watchPartyRooms.id, { onDelete: 'cascade' }),
    voiceMuted: boolean('voice_muted').notNull().default(false),
    volume: integer('volume').notNull().default(100),
    hideMessages: boolean('hide_messages').notNull().default(false),
    hideReactions: boolean('hide_reactions').notNull().default(false),
    hideAvatar: boolean('hide_avatar').notNull().default(false),
    hideRequests: boolean('hide_requests').notNull().default(false),
    blockInvites: boolean('block_invites').notNull().default(false),
    favourite: boolean('favourite').notNull().default(false),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('watch_party_personal_controls_scope_key')
      .on(table.userId, table.targetKey, table.roomId)
      .nullsNotDistinct(),
    check('watch_party_personal_controls_volume_check', sql`${table.volume} BETWEEN 0 AND 200`),
  ]
);

export const watchPartyInterest = pgTable(
  'watch_party_interest',
  {
    roomId: roomId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.userId] })]
);

export const watchPartyReports = pgTable(
  'watch_party_reports',
  {
    id: uuid('id').primaryKey(),
    roomId: roomId(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetKey: text('target_key'),
    context: text('context').$type<'room' | 'chat' | 'voice'>().notNull().default('room'),
    reason: text('reason').$type<'spam' | 'abuse' | 'sexual' | 'violence' | 'other'>().notNull(),
    details: text('details'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (table) => [
    unique('watch_party_reports_once_key')
      .on(table.roomId, table.reporterId, table.targetKey)
      .nullsNotDistinct(),
  ]
);
