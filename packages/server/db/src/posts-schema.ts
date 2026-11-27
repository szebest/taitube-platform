import {
  DISCLOSURES,
  type Disclosure,
  HELD_REASONS,
  type HeldReason,
  MODERATION_STATES,
  type ModerationState,
  POST_KINDS,
  POST_STATUSES,
  type PostKind,
  type PostPayload,
  type PostStatus,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { channels, users, videos } from './schema';

export const channelPosts = pgTable(
  'channel_posts',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').$type<PostKind>().notNull(),
    payload: jsonb('payload').$type<PostPayload>().notNull(),
    status: text('status').$type<PostStatus>().notNull(),
    publishAt: timestamptz('publish_at'),
    publishedAt: timestamptz('published_at'),
    pinnedAt: timestamptz('pinned_at'),
    commentsEnabled: boolean('comments_enabled').notNull().default(true),
    likeCount: integer('like_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    version: integer('version').notNull().default(1),
    editedAt: timestamptz('edited_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('channel_posts_channel_published_idx')
      .on(
        table.channelId,
        table.pinnedAt.desc().nullsLast(),
        table.publishedAt.desc(),
        table.id.desc()
      )
      .where(sql`${table.status} = 'published'`),
    index('channel_posts_channel_created_idx').on(table.channelId, table.createdAt.desc()),
    index('channel_posts_due_idx')
      .on(table.publishAt)
      .where(sql`${table.status} = 'scheduled'`),
    check('channel_posts_kind_check', sql`${table.kind} IN (${listOf(POST_KINDS)})`),
    check('channel_posts_status_check', sql`${table.status} IN (${listOf(POST_STATUSES)})`),
    check('channel_posts_kind_matches_payload', sql`${table.payload} ->> 'kind' = ${table.kind}`),
  ]
);

export const postReactions = pgTable(
  'post_reactions',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => channelPosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'LIKE'>().notNull().default('LIKE'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'post_reactions_pk', columns: [table.postId, table.userId] }),
    check('post_reactions_type_check', sql`${table.type} = 'LIKE'`),
  ]
);

export const postPollVotes = pgTable(
  'post_poll_votes',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => channelPosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    optionIndex: smallint('option_index').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('post_poll_votes_post_user_unique').on(table.postId, table.userId),
    check('post_poll_votes_option_check', sql`${table.optionIndex} BETWEEN 0 AND 5`),
  ]
);

export const videoThreads = pgTable(
  'video_threads',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    authorChannelId: uuid('author_channel_id')
      .notNull()
      .references(() => channels.id),
    anchorMs: integer('anchor_ms').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    pinnedAt: timestamptz('pinned_at'),
    commentsCount: integer('comments_count').notNull().default(0),
    moderationState: text('moderation_state')
      .$type<ModerationState>()
      .notNull()
      .default('published'),
    moderationDisclosure: text('moderation_disclosure').$type<Disclosure>(),
    heldReason: text('held_reason').$type<HeldReason>(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    index('video_threads_video_anchor_idx')
      .on(table.videoId, table.anchorMs)
      .where(sql`${table.deletedAt} IS NULL`),
    index('video_threads_author_video_idx')
      .on(table.authorId, table.videoId)
      .where(sql`${table.deletedAt} IS NULL`),
    check('video_threads_anchor_check', sql`${table.anchorMs} >= 0`),
    check('video_threads_title_length', sql`char_length(${table.title}) BETWEEN 1 AND 100`),
    check('video_threads_body_length', sql`char_length(${table.body}) <= 1000`),
    check(
      'video_threads_moderation_state_check',
      sql`${table.moderationState} IN (${listOf(MODERATION_STATES)})`
    ),
    check(
      'video_threads_moderation_disclosure_check',
      sql`${table.moderationDisclosure} IS NULL OR ${table.moderationDisclosure} IN (${listOf(DISCLOSURES)})`
    ),
    check(
      'video_threads_held_reason_check',
      sql`${table.heldReason} IS NULL OR ${table.heldReason} IN (${listOf(HELD_REASONS)})`
    ),
  ]
);

export const postStatsDaily = pgTable(
  'post_stats_daily',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => channelPosts.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    opens: integer('opens').notNull().default(0),
    shareClicks: integer('share_clicks').notNull().default(0),
  },
  (table) => [primaryKey({ name: 'post_stats_daily_pk', columns: [table.postId, table.day] })]
);
