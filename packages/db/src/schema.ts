import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ============================================================================
// Enums (SDD §5.2)
// ============================================================================
export const videoStatusEnum = pgEnum('video_status', [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED',
  'ABANDONED',
  'DELETED',
]);

export const uploadStatusEnum = pgEnum('upload_status', ['OPEN', 'COMPLETED', 'ABORTED']);

export const renditionStatusEnum = pgEnum('rendition_status', [
  'PENDING',
  'RUNNING',
  'DONE',
  'FAILED',
  'SKIPPED',
]);

export const stepStatusEnum = pgEnum('step_status', [
  'QUEUED',
  'RUNNING',
  'DONE',
  'FAILED',
  'DEAD',
]);

export const VideoStatuses = videoStatusEnum.enumValues;
export const StepStatuses = stepStatusEnum.enumValues;
export const UploadStatuses = uploadStatusEnum.enumValues;
export const RenditionStatuses = renditionStatusEnum.enumValues;

// Helper for timestamptz in postgres
const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ============================================================================
// Tables (SDD §5.2)
// ============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  tier: text('tier').notNull().default('free'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    visibility: text('visibility').notNull().default('private'),
    status: videoStatusEnum('status').notNull().default('UPLOADING'),
    sourceKey: text('source_key').notNull(),
    sourceSizeBytes: bigint('source_size_bytes', { mode: 'number' }),
    sourceContentType: text('source_content_type'),
    durationMs: integer('duration_ms'),
    width: integer('width'),
    height: integer('height'),
    fps: numeric('fps', { precision: 6, scale: 3 }),
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
    readyAt: timestamptz('ready_at'),
    deletedAt: timestamptz('deleted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('videos_owner_created_idx').on(table.ownerId, table.createdAt.desc()),
    index('videos_status_updated_idx').on(table.status, table.updatedAt),
  ]
);

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey(),
  videoId: uuid('video_id')
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: 'cascade' }),
  strategy: text('strategy').notNull(),
  multipartUploadId: text('multipart_upload_id'),
  partSizeBytes: integer('part_size_bytes'),
  partsExpected: integer('parts_expected'),
  declaredSizeBytes: bigint('declared_size_bytes', { mode: 'number' }).notNull(),
  declaredContentType: text('declared_content_type').notNull(),
  sha256: text('sha256'),
  status: uploadStatusEnum('status').notNull().default('OPEN'),
  expiresAt: timestamptz('expires_at').notNull(),
  completedAt: timestamptz('completed_at'),
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
    status: text('status').notNull().default('PARKED'),
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

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type Rendition = typeof renditions.$inferSelect;
export type NewRendition = typeof renditions.$inferInsert;
export type ProcessingStep = typeof processingSteps.$inferSelect;
export type NewProcessingStep = typeof processingSteps.$inferInsert;
export type VideoEvent = typeof videoEvents.$inferSelect;
export type NewVideoEvent = typeof videoEvents.$inferInsert;
export type DlqEntry = typeof dlqEntries.$inferSelect;
export type NewDlqEntry = typeof dlqEntries.$inferInsert;
export type OutboxRow = typeof outbox.$inferSelect;
export type NewOutboxRow = typeof outbox.$inferInsert;
