import {
  CONTENT_LINK_RELATIONS,
  CONTENT_LINK_STATUSES,
  CONTENT_REF_TYPES,
  type ContentLinkParams,
  type ContentLinkStatus,
  type ContentRefType,
  END_SCREEN_LAYOUTS,
  type EndScreenItem,
  type EndScreenLayout,
  LINK_ORIGINS,
  LINK_POLICIES,
  type LinkOrigin,
  type LinkPolicy,
  type StoredLinkRelation,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import { channels, users, videos } from './schema';

const STORED_RELATIONS = CONTENT_LINK_RELATIONS.filter((relation) => relation !== 'clip_of');

/** `source_aux_id` / `target_aux_id` hold an episode's playlist; the unique key treats a missing one as ''. */
export const contentLinks = pgTable(
  'content_links',
  {
    id: uuid('id').primaryKey(),
    sourceType: text('source_type').$type<ContentRefType>().notNull(),
    sourceId: uuid('source_id').notNull(),
    sourceAuxId: uuid('source_aux_id'),
    targetType: text('target_type').$type<ContentRefType>().notNull(),
    targetId: uuid('target_id').notNull(),
    targetAuxId: uuid('target_aux_id'),
    relation: text('relation').$type<StoredLinkRelation>().notNull(),
    params: jsonb('params').$type<ContentLinkParams>().notNull(),
    sourceStartMs: integer('source_start_ms'),
    sourceEndMs: integer('source_end_ms'),
    targetStartMs: integer('target_start_ms'),
    targetEndMs: integer('target_end_ms'),
    status: text('status').$type<ContentLinkStatus>().notNull(),
    sourceChannelId: uuid('source_channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    targetChannelId: uuid('target_channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    origin: text('origin').$type<LinkOrigin>().notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('content_links_source_target_relation_unique')
      .on(
        table.sourceType,
        table.sourceId,
        sql`coalesce(${table.sourceAuxId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        table.targetType,
        table.targetId,
        sql`coalesce(${table.targetAuxId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        table.relation
      )
      .where(sql`${table.status} <> 'declined'`),
    index('content_links_source_idx').on(table.sourceType, table.sourceId, table.status),
    index('content_links_target_idx').on(table.targetType, table.targetId, table.status),
    index('content_links_queue_idx').on(table.targetChannelId, table.status, table.createdAt),
    index('content_links_source_channel_idx').on(table.sourceChannelId, table.status),
    check(
      'content_links_source_type_check',
      sql`${table.sourceType} IN (${listOf(CONTENT_REF_TYPES)})`
    ),
    check(
      'content_links_target_type_check',
      sql`${table.targetType} IN (${listOf(CONTENT_REF_TYPES)})`
    ),
    check('content_links_relation_check', sql`${table.relation} IN (${listOf(STORED_RELATIONS)})`),
    check('content_links_origin_check', sql`${table.origin} IN (${listOf(LINK_ORIGINS)})`),
    check('content_links_status_check', sql`${table.status} IN (${listOf(CONTENT_LINK_STATUSES)})`),
    check(
      'content_links_params_relation_check',
      sql`${table.params} ->> 'relation' = ${table.relation}`
    ),
    check(
      'content_links_source_span_check',
      sql`${table.sourceEndMs} IS NULL OR (${table.sourceStartMs} IS NOT NULL AND ${table.sourceEndMs} > ${table.sourceStartMs})`
    ),
    check(
      'content_links_target_span_check',
      sql`${table.targetEndMs} IS NULL OR (${table.targetStartMs} IS NOT NULL AND ${table.targetEndMs} > ${table.targetStartMs})`
    ),
  ]
);

export const contentLinkDismissals = pgTable(
  'content_link_dismissals',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    /** The suggestion's identity: source, target and relation keys joined, as the suggestion service builds it. */
    suggestionKey: text('suggestion_key').notNull(),
    dismissedBy: uuid('dismissed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.suggestionKey] })]
);

export const videoEndScreens = pgTable(
  'video_end_screens',
  {
    videoId: uuid('video_id')
      .primaryKey()
      .references(() => videos.id, { onDelete: 'cascade' }),
    layout: text('layout').$type<EndScreenLayout>().notNull(),
    startsAtMs: integer('starts_at_ms').notNull(),
    items: jsonb('items').$type<EndScreenItem[]>().notNull(),
    showSubscribe: boolean('show_subscribe').notNull().default(false),
    version: integer('version').notNull().default(1),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'video_end_screens_layout_check',
      sql`${table.layout} IN (${listOf(END_SCREEN_LAYOUTS)})`
    ),
    check('video_end_screens_items_check', sql`jsonb_array_length(${table.items}) <= 4`),
  ]
);

export const contentLinkStatsDaily = pgTable(
  'content_link_stats_daily',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => contentLinks.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    impressions: bigint('impressions', { mode: 'number' }).notNull().default(0),
    clicks: bigint('clicks', { mode: 'number' }).notNull().default(0),
    watchSeconds: bigint('watch_seconds', { mode: 'number' }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.linkId, table.day] })]
);

export const channelLinkSettings = pgTable(
  'channel_link_settings',
  {
    channelId: uuid('channel_id')
      .primaryKey()
      .references(() => channels.id, { onDelete: 'cascade' }),
    linkPolicy: text('link_policy').$type<LinkPolicy>().notNull().default('approve'),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'channel_link_settings_policy_check',
      sql`${table.linkPolicy} IN (${listOf(LINK_POLICIES)})`
    ),
  ]
);
