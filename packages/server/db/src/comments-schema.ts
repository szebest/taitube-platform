import {
  COMMENT_MODERATION_REASONS,
  COMMENT_TARGET_TYPES,
  type CommentModerationReason,
  type CommentTarget,
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
import { channels, users } from './schema';

/**
 * Comments on a video, a post or a thread. The target has no foreign key: deleting a target
 * deletes its comments through the `*_delete_comments` triggers of the migration that made the
 * table, in the same transaction.
 */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    targetType: text('target_type').$type<CommentTarget['type']>().notNull(),
    targetId: uuid('target_id').notNull(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    authorChannelId: uuid('author_channel_id')
      .notNull()
      .references(() => channels.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
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
    index('comments_top_idx').on(
      table.targetType,
      table.targetId,
      table.parentId,
      table.isPinned.desc(),
      table.likeCount.desc(),
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('comments_newest_idx').on(
      table.targetType,
      table.targetId,
      table.parentId,
      table.isPinned.desc(),
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('comments_author_created_idx')
      .on(table.authorId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    index('comments_author_channel_created_idx').on(table.authorChannelId, table.createdAt.desc()),
    index('comments_channel_created_idx').on(
      table.channelId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    uniqueIndex('comments_one_pinned_per_target_idx')
      .on(table.targetType, table.targetId)
      .where(sql`${table.isPinned} AND ${table.deletedAt} IS NULL`),
    index('comments_moderation_idx')
      .on(table.targetType, table.targetId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.moderationState} <> 'published'`),
    check(
      'comments_target_type_check',
      sql`${table.targetType} IN (${listOf(COMMENT_TARGET_TYPES)})`
    ),
    check(
      'comments_moderation_state_check',
      sql`${table.moderationState} IN (${listOf(MODERATION_STATES)})`
    ),
    check(
      'comments_moderation_disclosure_check',
      sql`${table.moderationDisclosure} IS NULL OR ${table.moderationDisclosure} IN (${listOf(DISCLOSURES)})`
    ),
    check(
      'comments_moderation_reason_check',
      sql`${table.moderationReason} IS NULL OR ${table.moderationReason} IN (${listOf(COMMENT_MODERATION_REASONS)})`
    ),
    check(
      'comments_held_reason_check',
      sql`${table.heldReason} IS NULL OR ${table.heldReason} IN (${listOf(HELD_REASONS)})`
    ),
  ]
);
