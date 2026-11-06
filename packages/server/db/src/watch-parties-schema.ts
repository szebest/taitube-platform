import type {
  MemberKind,
  RoleKind,
  WatchPartyBufferPolicy,
  WatchPartyCloseReason,
  WatchPartyIdleClose,
  WatchPartyJoinPath,
  WatchPartyPhase,
  WatchPartyPlayback,
  WatchPartyStatus,
  WatchPartyVisibility,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
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
import { channels, users, videos } from './schema';

const version = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);

export const watchPartyRooms = pgTable(
  'watch_party_rooms',
  {
    id: uuid('id').primaryKey(),
    ownerKey: text('owner_key').notNull(),
    asChannelId: uuid('as_channel_id').references(() => channels.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    visibility: text('visibility').$type<WatchPartyVisibility>().notNull(),
    passwordHash: text('password_hash'),
    capacity: integer('capacity'),
    allowGuests: boolean('allow_guests').notNull(),
    chatEnabled: boolean('chat_enabled').notNull().default(true),
    slowModeSeconds: integer('slow_mode_seconds').notNull().default(0),
    bufferPolicy: text('buffer_policy').$type<WatchPartyBufferPolicy>().notNull().default('wait'),
    autoplay: boolean('autoplay').notNull().default(true),
    skipVotePercent: integer('skip_vote_percent').notNull().default(50),
    idleClose: text('idle_close').$type<WatchPartyIdleClose>().notNull().default('15m'),
    language: text('language'),
    accent: text('accent'),
    scheduledFor: timestamptz('scheduled_for'),
    autoStart: boolean('auto_start').notNull().default(false),
    phase: text('phase').$type<WatchPartyPhase>().notNull().default('lobby'),
    playback: jsonb('playback').$type<WatchPartyPlayback>().notNull(),
    playbackVersion: version('playback_version'),
    rolesVersion: version('roles_version'),
    permissionsVersion: integer('permissions_version').notNull(),
    queueLength: integer('queue_length').notNull().default(0),
    queueVersion: version('queue_version'),
    currentVideoId: uuid('current_video_id').references(() => videos.id, { onDelete: 'set null' }),
    presentCount: integer('present_count').notNull().default(0),
    trendScore: doublePrecision('trend_score').notNull().default(0),
    searchText: text('search_text').notNull().default(''),
    status: text('status').$type<WatchPartyStatus>().notNull().default('open'),
    closedReason: text('closed_reason').$type<WatchPartyCloseReason>(),
    hiddenAt: timestamptz('hidden_at'),
    version: integer('version').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    startedAt: timestamptz('started_at'),
    lastPresentAt: timestamptz('last_present_at'),
    closedAt: timestamptz('closed_at'),
  },
  (table) => {
    const listed = sql`${table.status} = 'open' AND ${table.visibility} = 'public' AND ${table.hiddenAt} IS NULL`;
    return [
      index('watch_party_rooms_owner_open_idx')
        .on(table.ownerKey)
        .where(sql`${table.status} = 'open'`),
      index('watch_party_rooms_open_last_present_idx')
        .on(table.lastPresentAt)
        .where(sql`${table.status} = 'open'`),
      index('watch_party_rooms_closed_at_idx')
        .on(table.closedAt)
        .where(sql`${table.status} = 'closed'`),
      index('watch_party_rooms_members_keyset_idx')
        .on(table.presentCount.desc(), table.id)
        .where(listed),
      index('watch_party_rooms_newest_keyset_idx')
        .on(table.createdAt.desc(), table.id)
        .where(listed),
      index('watch_party_rooms_starting_soon_keyset_idx')
        .on(table.scheduledFor, table.id)
        .where(listed),
      index('watch_party_rooms_trending_keyset_idx')
        .on(table.trendScore.desc(), table.id)
        .where(listed),
      check(
        'watch_party_rooms_capacity_check',
        sql`${table.capacity} IS NULL OR ${table.capacity} >= 2`
      ),
      check(
        'watch_party_rooms_slow_mode_check',
        sql`${table.slowModeSeconds} IN (0, 5, 10, 30, 60)`
      ),
      check('watch_party_rooms_skip_vote_check', sql`${table.skipVotePercent} BETWEEN 1 AND 100`),
    ];
  }
);

const roomId = () =>
  uuid('room_id')
    .notNull()
    .references(() => watchPartyRooms.id, { onDelete: 'cascade' });

export const watchPartyMembers = pgTable(
  'watch_party_members',
  {
    roomId: roomId(),
    memberKey: text('member_key').notNull(),
    kind: text('kind').$type<MemberKind>().notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    discordUserId: text('discord_user_id'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    joinedVia: text('joined_via').$type<WatchPartyJoinPath>().notNull(),
    joinedAt: timestamptz('joined_at').notNull(),
    leftAt: timestamptz('left_at'),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.memberKey] }),
    index('watch_party_members_user_idx').on(table.userId),
  ]
);

export const watchPartyRoles = pgTable(
  'watch_party_roles',
  {
    id: uuid('id').primaryKey(),
    roomId: roomId(),
    key: text('key'),
    kind: text('kind').$type<RoleKind>().notNull(),
    name: text('name').notNull(),
    colour: text('colour'),
    position: integer('position').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('watch_party_roles_room_key_key')
      .on(table.roomId, table.key)
      .where(sql`${table.key} IS NOT NULL`),
    unique('watch_party_roles_room_position_key').on(table.roomId, table.position),
  ]
);

export const watchPartyRolePermissions = pgTable(
  'watch_party_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => watchPartyRoles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })]
);

export const watchPartyMemberRoles = pgTable(
  'watch_party_member_roles',
  {
    roomId: roomId(),
    memberKey: text('member_key').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => watchPartyRoles.id, { onDelete: 'cascade' }),
    grantedBy: text('granted_by').notNull(),
    expiresAt: timestamptz('expires_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.memberKey, table.roleId] }),
    index('watch_party_member_roles_expires_idx')
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL`),
  ]
);

export const watchPartyBans = pgTable(
  'watch_party_bans',
  {
    roomId: roomId(),
    memberKey: text('member_key').notNull(),
    ipHash: text('ip_hash'),
    bannedBy: text('banned_by').notNull(),
    reason: text('reason'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.memberKey] }),
    index('watch_party_bans_ip_idx')
      .on(table.roomId, table.ipHash)
      .where(sql`${table.ipHash} IS NOT NULL`),
  ]
);
