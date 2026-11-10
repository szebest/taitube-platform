import {
  COMMENT_MODERATION_REASONS,
  DEFAULT_DISCLOSURE,
  DISCLOSURES,
  type DisclosureDefaults,
  REVIEW_MODES,
  type RestrictionKind,
  type ReviewMode,
} from '@vp/domain';
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
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { channels, users, videos } from './schema';

const channelRef = () =>
  uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' });

const userRef = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' });

const actorRef = (name: string) => uuid(name).references(() => users.id, { onDelete: 'set null' });

/** One row per channel, written on the first save; a channel without a row has the defaults. */
export const channelCommentSettings = pgTable(
  'channel_comment_settings',
  {
    channelId: uuid('channel_id')
      .primaryKey()
      .references(() => channels.id, { onDelete: 'cascade' }),
    reviewMode: text('review_mode').$type<ReviewMode>().notNull().default('none'),
    blockedWords: text('blocked_words')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    linkAllowlist: text('link_allowlist')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    slowModeSeconds: integer('slow_mode_seconds'),
    subscribersOnly: boolean('subscribers_only').notNull().default(false),
    minAccountAgeDays: integer('min_account_age_days').notNull().default(0),
    disclosure: jsonb('disclosure')
      .$type<DisclosureDefaults>()
      .notNull()
      .default(DEFAULT_DISCLOSURE),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'channel_comment_settings_review_mode_check',
      sql`${table.reviewMode} IN (${listOf(REVIEW_MODES)})`
    ),
    check(
      'channel_comment_settings_slow_mode_check',
      sql`${table.slowModeSeconds} IS NULL OR ${table.slowModeSeconds} > 0`
    ),
    check(
      'channel_comment_settings_min_age_check',
      sql`${table.minAccountAgeDays} BETWEEN 0 AND 30`
    ),
  ]
);

/**
 * A ban affects writes and a shadow ban affects reads, both read at the time they are needed, so
 * an expired row counts as absent with no job. Only a ban can expire.
 */
export const channelUserRestrictions = pgTable(
  'channel_user_restrictions',
  {
    channelId: channelRef(),
    userId: userRef('user_id'),
    kind: text('kind').$type<RestrictionKind>().notNull(),
    reason: text('reason'),
    expiresAt: timestamptz('expires_at'),
    createdBy: actorRef('created_by'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.channelId, table.userId] }),
    index('channel_user_restrictions_user_idx').on(table.userId),
    index('channel_user_restrictions_expires_idx')
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL`),
    check('channel_user_restrictions_kind_check', sql`${table.kind} IN ('shadow', 'ban')`),
    check(
      'channel_user_restrictions_expiry_check',
      sql`${table.kind} = 'ban' OR ${table.expiresAt} IS NULL`
    ),
    check(
      'channel_user_restrictions_reason_check',
      sql`${table.reason} IS NULL OR char_length(${table.reason}) <= 200`
    ),
  ]
);

export const channelTrustedCommenters = pgTable(
  'channel_trusted_commenters',
  {
    channelId: channelRef(),
    userId: userRef('user_id'),
    createdBy: actorRef('created_by'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.userId] })]
);

export const channelSavedReplies = pgTable(
  'channel_saved_replies',
  {
    id: uuid('id').primaryKey(),
    channelId: channelRef(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    index('channel_saved_replies_channel_position_idx').on(table.channelId, table.position),
    check('channel_saved_replies_title_check', sql`char_length(${table.title}) BETWEEN 1 AND 40`),
    check('channel_saved_replies_body_check', sql`char_length(${table.body}) BETWEEN 1 AND 2000`),
  ]
);

/** 42's delete is soft, so the reason and an excerpt live here for the author's list. */
export const commentRemovals = pgTable(
  'comment_removals',
  {
    id: uuid('id').primaryKey(),
    channelId: channelRef(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    authorId: userRef('author_id'),
    excerpt: text('excerpt').notNull(),
    reason: text('reason').notNull(),
    note: text('note'),
    disclosure: text('disclosure').notNull(),
    removedBy: actorRef('removed_by'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('comment_removals_author_created_idx').on(table.authorId, table.createdAt.desc()),
    index('comment_removals_created_at_idx').on(table.createdAt),
    check(
      'comment_removals_reason_check',
      sql`${table.reason} IN (${listOf(COMMENT_MODERATION_REASONS)})`
    ),
    check(
      'comment_removals_disclosure_check',
      sql`${table.disclosure} IN (${listOf(DISCLOSURES)})`
    ),
    check(
      'comment_removals_note_check',
      sql`${table.note} IS NULL OR char_length(${table.note}) <= 200`
    ),
  ]
);
