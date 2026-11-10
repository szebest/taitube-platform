import {
  COMMENT_MODERATION_REASONS,
  type CommentModerationReason,
  DISCLOSURES,
  type Disclosure,
  HELD_REASONS,
  type HeldReason,
  MODERATION_STATES,
  type ModerationState,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { users, videos } from './schema';

export const videoComments = pgTable(
  'video_comments',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => videoComments.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    isEdited: boolean('is_edited').notNull().default(false),
    likeCount: integer('like_count').notNull().default(0),
    heartedAt: timestamptz('hearted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
    moderationState: text('moderation_state')
      .$type<ModerationState>()
      .notNull()
      .default('published'),
    moderationDisclosure: text('moderation_disclosure').$type<Disclosure>(),
    moderationReason: text('moderation_reason').$type<CommentModerationReason>(),
    moderationNote: text('moderation_note'),
    moderatedBy: uuid('moderated_by').references(() => users.id, { onDelete: 'set null' }),
    moderatedAt: timestamptz('moderated_at'),
    heldReason: text('held_reason').$type<HeldReason>(),
    looksLikeQuestion: boolean('looks_like_question').notNull().default(false),
  },
  (table) => [
    index('video_comments_top_idx').on(
      table.videoId,
      table.parentId,
      table.isPinned.desc(),
      table.likeCount.desc(),
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('video_comments_newest_idx').on(
      table.videoId,
      table.parentId,
      table.isPinned.desc(),
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('video_comments_author_created_idx')
      .on(table.authorId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('video_comments_one_pinned_per_video_idx')
      .on(table.videoId)
      .where(sql`${table.isPinned} AND ${table.deletedAt} IS NULL`),
    index('video_comments_moderation_idx')
      .on(table.videoId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.moderationState} <> 'published'`),
    check(
      'video_comments_moderation_state_check',
      sql`${table.moderationState} IN (${listOf(MODERATION_STATES)})`
    ),
    check(
      'video_comments_moderation_disclosure_check',
      sql`${table.moderationDisclosure} IS NULL OR ${table.moderationDisclosure} IN (${listOf(DISCLOSURES)})`
    ),
    check(
      'video_comments_moderation_reason_check',
      sql`${table.moderationReason} IS NULL OR ${table.moderationReason} IN (${listOf(COMMENT_MODERATION_REASONS)})`
    ),
    check(
      'video_comments_held_reason_check',
      sql`${table.heldReason} IS NULL OR ${table.heldReason} IN (${listOf(HELD_REASONS)})`
    ),
  ]
);
