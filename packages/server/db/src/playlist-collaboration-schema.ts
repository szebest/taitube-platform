import {
  PLAYLIST_ACTIVITY_ACTIONS,
  PLAYLIST_COLLABORATOR_ROLES,
  PLAYLIST_INVITE_MAX_USES,
  type PlaylistActivityAction,
  type PlaylistActivityEntry,
  type PlaylistCollaboratorRole,
  SHARE_LINK_TOKEN_LENGTH,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { playlists } from './library-schema';
import { users, videos } from './schema';

const ROLE_LIST = listOf(PLAYLIST_COLLABORATOR_ROLES);

export const playlistCollaborators = pgTable(
  'playlist_collaborators',
  {
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<PlaylistCollaboratorRole>().notNull(),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.userId] }),
    index('playlist_collaborators_user_idx').on(table.userId),
    check('playlist_collaborators_role_check', sql`${table.role} IN (${ROLE_LIST})`),
  ]
);

export const playlistInvites = pgTable(
  'playlist_invites',
  {
    id: uuid('id').primaryKey(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    role: text('role').$type<PlaylistCollaboratorRole>().notNull(),
    token: text('token').notNull(),
    inviteeUserId: uuid('invitee_user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamptz('expires_at').notNull(),
    maxUses: integer('max_uses'),
    useCount: integer('use_count').notNull().default(0),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('playlist_invites_token_idx').on(table.token),
    uniqueIndex('playlist_invites_one_per_invitee_idx')
      .on(table.playlistId, table.inviteeUserId)
      .where(sql`${table.inviteeUserId} IS NOT NULL`),
    index('playlist_invites_playlist_idx').on(table.playlistId, table.createdAt.desc()),
    check('playlist_invites_role_check', sql`${table.role} IN (${ROLE_LIST})`),
    check(
      'playlist_invites_token_check',
      sql`char_length(${table.token}) = ${sql.raw(String(SHARE_LINK_TOKEN_LENGTH))}`
    ),
    check(
      'playlist_invites_max_uses_check',
      sql`${table.maxUses} IS NULL OR ${table.maxUses} BETWEEN 1 AND ${sql.raw(String(PLAYLIST_INVITE_MAX_USES))}`
    ),
    check('playlist_invites_use_count_check', sql`${table.useCount} >= 0`),
  ]
);

export const playlistActivity = pgTable(
  'playlist_activity',
  {
    id: uuid('id').primaryKey(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').$type<PlaylistActivityAction>().notNull(),
    target: jsonb('target').$type<PlaylistActivityEntry['target']>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('playlist_activity_playlist_idx').on(
      table.playlistId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('playlist_activity_created_idx').on(table.createdAt),
    check(
      'playlist_activity_action_check',
      sql`${table.action} IN (${listOf(PLAYLIST_ACTIVITY_ACTIONS)})`
    ),
  ]
);

export const playlistFollows = pgTable(
  'playlist_follows',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.playlistId] }),
    index('playlist_follows_playlist_idx').on(table.playlistId),
  ]
);

export const playlistStatsDaily = pgTable(
  'playlist_stats_daily',
  {
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    opens: integer('opens').notNull().default(0),
    plays: integer('plays').notNull().default(0),
    follows: integer('follows').notNull().default(0),
    forks: integer('forks').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.playlistId, table.day] })]
);

export const playlistPlaysDaily = pgTable(
  'playlist_plays_daily',
  {
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    plays: integer('plays').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.playlistId, table.videoId, table.day] })]
);
