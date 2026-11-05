import {
  LIVE_CHAT_MESSAGE_MAX,
  LIVE_CHAT_SLOW_MODE_MAX_SECONDS,
  LIVE_STREAM_STATUSES,
  type LiveMarker,
  type VideoVisibility,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { channels, users, videos } from './schema';

export const liveStreamStatusEnum = pgEnum('live_stream_status', LIVE_STREAM_STATUSES);

export const liveStreams = pgTable(
  'live_streams',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    streamKey: text('stream_key'),
    status: liveStreamStatusEnum('status').notNull().default('IDLE'),
    visibility: text('visibility').$type<VideoVisibility>().notNull().default('public'),
    archiveVisibility: text('archive_visibility')
      .$type<VideoVisibility>()
      .notNull()
      .default('public'),
    overlayToken: text('overlay_token').unique(),
    controlToken: text('control_token').unique(),
    currentViewers: integer('current_viewers').notNull().default(0),
    chatSlowModeSeconds: integer('chat_slow_mode_seconds').notNull().default(0),
    chatSubscribersOnly: boolean('chat_subscribers_only').notNull().default(false),
    markers: jsonb('markers').$type<LiveMarker[]>().notNull().default([]),
    startedAt: timestamptz('started_at'),
    endedAt: timestamptz('ended_at'),
    stopRequestedAt: timestamptz('stop_requested_at'),
    videoId: uuid('video_id')
      .unique()
      .references(() => videos.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('live_streams_channel_status_idx').on(table.channelId, table.status),
    uniqueIndex('live_streams_stream_key_key').on(table.streamKey),
    uniqueIndex('live_streams_one_open_per_channel')
      .on(table.channelId)
      .where(sql`${table.status} IN ('IDLE', 'LIVE')`),
    index('live_streams_live_now_idx')
      .on(table.startedAt.desc(), table.id.desc())
      .where(sql`${table.status} = 'LIVE'`),
    check(
      'live_streams_slow_mode_check',
      sql`${table.chatSlowModeSeconds} BETWEEN 0 AND ${sql.raw(String(LIVE_CHAT_SLOW_MODE_MAX_SECONDS))}`
    ),
  ]
);

export const liveChatMessages = pgTable(
  'live_chat_messages',
  {
    id: uuid('id').primaryKey(),
    liveStreamId: uuid('live_stream_id')
      .notNull()
      .references(() => liveStreams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    offsetMs: integer('offset_ms').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    removedAt: timestamptz('removed_at'),
  },
  (table) => [
    index('live_chat_messages_stream_id_idx').on(table.liveStreamId, table.id),
    index('live_chat_messages_stream_offset_idx').on(table.liveStreamId, table.offsetMs, table.id),
    check(
      'live_chat_messages_length_check',
      sql`char_length(${table.message}) BETWEEN 1 AND ${sql.raw(String(LIVE_CHAT_MESSAGE_MAX))}`
    ),
    check('live_chat_messages_offset_check', sql`${table.offsetMs} >= 0`),
  ]
);
