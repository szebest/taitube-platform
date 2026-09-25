import {
  RENDITION_STATUSES,
  STEP_STATUSES,
  UPLOAD_STATUSES,
  USER_ROLES,
  type UserTier,
  VIDEO_STATUSES,
  type VideoVisibility,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const videoStatusEnum = pgEnum('video_status', VIDEO_STATUSES);

export const uploadStatusEnum = pgEnum('upload_status', UPLOAD_STATUSES);

export const renditionStatusEnum = pgEnum('rendition_status', RENDITION_STATUSES);

export const stepStatusEnum = pgEnum('step_status', STEP_STATUSES);

export const userRoleEnum = pgEnum('user_role', USER_ROLES);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  tier: text('tier').$type<UserTier>().notNull().default('free'),
  role: userRoleEnum('role').notNull().default('USER'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bannerUrl: text('banner_url'),
    bio: text('bio'),
    subscriberCount: integer('subscriber_count').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('channels_handle_idx').on(table.handle),
    index('channels_user_id_idx').on(table.userId),
  ]
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    iconUrl: text('icon_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [index('categories_sort_order_name_idx').on(table.sortOrder, table.name)]
);

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    visibility: text('visibility').$type<VideoVisibility>().notNull().default('private'),
    status: videoStatusEnum('status').notNull().default('UPLOADING'),
    sourceKey: text('source_key').notNull(),
    sourceSizeBytes: bigint('source_size_bytes', { mode: 'number' }),
    sourceContentType: text('source_content_type'),
    durationMs: integer('duration_ms'),
    width: integer('width'),
    height: integer('height'),
    fps: numeric('fps', { precision: 6, scale: 3, mode: 'number' }),
    videoCodec: text('video_codec'),
    audioCodec: text('audio_codec'),
    ladder: jsonb('ladder'),
    masterPlaylistKey: text('master_playlist_key'),
    posterKey: text('poster_key'),
    spriteKey: text('sprite_key'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    generation: integer('generation').notNull().default(1),
    version: integer('version').notNull().default(0),
    viewsCount: integer('views_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    likesCount: integer('likes_count').notNull().default(0),
    dislikesCount: integer('dislikes_count').notNull().default(0),
    readyAt: timestamptz('ready_at'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('videos_owner_created_idx').on(table.ownerId, table.createdAt.desc()),
    index('videos_status_updated_idx').on(table.status, table.updatedAt),
    index('videos_category_id_idx').on(table.categoryId),
  ]
);

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey(),
  videoId: uuid('video_id')
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: 'cascade' }),
  strategy: text('strategy').$type<'single' | 'multipart'>().notNull(),
  multipartUploadId: text('multipart_upload_id'),
  partSizeBytes: integer('part_size_bytes'),
  partsExpected: integer('parts_expected'),
  declaredSizeBytes: bigint('declared_size_bytes', { mode: 'number' }).notNull(),
  declaredContentType: text('declared_content_type').notNull(),
  sha256: text('sha256'),
  status: uploadStatusEnum('status').notNull().default('OPEN'),
  expiresAt: timestamptz('expires_at').notNull(),
  completedAt: timestamptz('completed_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const renditions = pgTable(
  'renditions',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    videoBitrateKbps: integer('video_bitrate_kbps').notNull(),
    audioBitrateKbps: integer('audio_bitrate_kbps').notNull(),
    status: renditionStatusEnum('status').notNull().default('PENDING'),
    playlistKey: text('playlist_key'),
    segmentCount: integer('segment_count'),
    bytes: bigint('bytes', { mode: 'number' }),
    processingMs: integer('processing_ms'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('renditions_video_id_name_unique').on(table.videoId, table.name)]
);

export const processingSteps = pgTable(
  'processing_steps',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    step: text('step').notNull(),
    rendition: text('rendition').notNull().default('-'),
    jobId: text('job_id').notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: stepStatusEnum('status').notNull().default('QUEUED'),
    workerId: text('worker_id'),
    lockToken: uuid('lock_token'),
    startedAt: timestamptz('started_at'),
    heartbeatAt: timestamptz('heartbeat_at'),
    finishedAt: timestamptz('finished_at'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    result: jsonb('result'),
  },
  (table) => [
    unique('processing_steps_video_id_step_rendition_unique').on(
      table.videoId,
      table.step,
      table.rendition
    ),
  ]
);

export const videoEvents = pgTable(
  'video_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    traceId: text('trace_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [index('video_events_video_idx').on(table.videoId, table.id)]
);

export const dlqEntries = pgTable(
  'dlq_entries',
  {
    id: uuid('id').primaryKey(),
    queue: text('queue').notNull(),
    jobId: text('job_id').notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
    payload: jsonb('payload').notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    stack: text('stack'),
    attemptsMade: integer('attempts_made').notNull(),
    workerId: text('worker_id'),
    status: text('status').$type<'PARKED' | 'REPLAYED' | 'DISCARDED'>().notNull().default('PARKED'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    replayedAt: timestamptz('replayed_at'),
  },
  (table) => [
    unique('dlq_entries_queue_job_id_attempts_made_unique').on(
      table.queue,
      table.jobId,
      table.attemptsMade
    ),
  ]
);

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    publishedAt: timestamptz('published_at'),
    attempts: integer('attempts').notNull().default(0),
  },
  (table) => [index('outbox_drain_idx').on(table.publishedAt, table.createdAt)]
);

export const videoReactions = pgTable(
  'video_reactions',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('video_reactions_user_id_video_id_unique').on(table.userId, table.videoId),
    index('video_reactions_video_id_type_idx').on(table.videoId, table.type),
  ]
);

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
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
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
    uniqueIndex('video_comments_one_pinned_per_video_idx')
      .on(table.videoId)
      .where(sql`${table.isPinned} AND ${table.deletedAt} IS NULL`),
  ]
);

export const channelSubscriptions = pgTable(
  'channel_subscriptions',
  {
    id: uuid('id').primaryKey(),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('channel_subscriptions_subscriber_channel_unique').on(
      table.subscriberId,
      table.channelId
    ),
    index('channel_subscriptions_subscriber_created_idx').on(
      table.subscriberId,
      table.createdAt.desc()
    ),
    index('channel_subscriptions_channel_created_idx').on(table.channelId, table.createdAt.desc()),
  ]
);
