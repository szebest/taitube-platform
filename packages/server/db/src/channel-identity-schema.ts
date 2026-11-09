import {
  type ChannelImageKind,
  IMAGE_UPLOAD_STATUSES,
  type ImageCrops,
  type ImageUploadStatus,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { channels, users, videos } from './schema';

export const channelHandleHistory = pgTable(
  'channel_handle_history',
  {
    handle: text('handle').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    retiredAt: timestamptz('retired_at').notNull(),
  },
  (table) => [index('channel_handle_history_retired_at_idx').on(table.retiredAt)]
);

const STATUS_LIST = sql.raw(IMAGE_UPLOAD_STATUSES.map((value) => `'${value}'`).join(', '));

export const channelImageUploads = pgTable(
  'channel_image_uploads',
  {
    id: uuid('id').primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ChannelImageKind>().notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: text('status').$type<ImageUploadStatus>().notNull().default('issued'),
    width: integer('width'),
    height: integer('height'),
    crops: jsonb('crops').$type<ImageCrops>(),
    version: integer('version'),
    failure: text('failure'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('channel_image_uploads_version_key').on(table.channelId, table.kind, table.version),
    index('channel_image_uploads_channel_idx').on(table.channelId, table.kind),
    index('channel_image_uploads_status_idx').on(table.status, table.updatedAt),
    check('channel_image_uploads_kind_check', sql`${table.kind} IN ('avatar', 'banner')`),
    check('channel_image_uploads_status_check', sql`${table.status} IN (${STATUS_LIST})`),
  ]
);

export const channelPageSettings = pgTable('channel_page_settings', {
  channelId: uuid('channel_id')
    .primaryKey()
    .references(() => channels.id, { onDelete: 'cascade' }),
  trailerVideoId: uuid('trailer_video_id').references(() => videos.id, { onDelete: 'set null' }),
  returningVideoId: uuid('returning_video_id').references(() => videos.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const channelLocalizations = pgTable(
  'channel_localizations',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    description: text('description'),
    trailerVideoId: uuid('trailer_video_id').references(() => videos.id, { onDelete: 'set null' }),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.locale] })]
);
