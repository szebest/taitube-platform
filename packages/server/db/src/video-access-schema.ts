import {
  EXPERIMENT_KINDS,
  EXPERIMENT_STATUSES,
  EXPERIMENT_VARIANT_IDS,
  type ExperimentKind,
  type ExperimentStatus,
  type ExperimentVariant,
  type ExperimentVariantId,
  SHARE_LINK_LABEL_MAX_LENGTH,
  SHARE_LINK_TARGET_TYPES,
  SHARE_LINK_TOKEN_LENGTH,
  type ShareLinkTargetType,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
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
import { users, videos } from './schema';

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey(),
    targetType: text('target_type').$type<ShareLinkTargetType>().notNull(),
    targetId: uuid('target_id').notNull(),
    token: text('token').notNull(),
    label: text('label'),
    expiresAt: timestamptz('expires_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('share_links_token_idx').on(table.token),
    index('share_links_target_idx').on(table.targetType, table.targetId, table.createdAt.desc()),
    check(
      'share_links_target_type_check',
      sql`${table.targetType} IN (${listOf(SHARE_LINK_TARGET_TYPES)})`
    ),
    check(
      'share_links_token_check',
      sql`char_length(${table.token}) = ${sql.raw(String(SHARE_LINK_TOKEN_LENGTH))}`
    ),
    check(
      'share_links_label_check',
      sql`${table.label} IS NULL OR char_length(${table.label}) BETWEEN 1 AND ${sql.raw(String(SHARE_LINK_LABEL_MAX_LENGTH))}`
    ),
  ]
);

export const shareLinkStats = pgTable(
  'share_link_stats',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    opens: integer('opens').notNull().default(0),
    views: integer('views').notNull().default(0),
    watchSeconds: bigint('watch_seconds', { mode: 'number' }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.linkId, table.day] })]
);

export const videoExperiments = pgTable(
  'video_experiments',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ExperimentKind>().notNull(),
    variants: jsonb('variants').$type<ExperimentVariant[]>().notNull(),
    status: text('status').$type<ExperimentStatus>().notNull().default('running'),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    endedAt: timestamptz('ended_at'),
    winnerVariantId: text('winner_variant_id').$type<ExperimentVariantId>(),
  },
  (table) => [
    uniqueIndex('video_experiments_running_idx')
      .on(table.videoId)
      .where(sql`${table.status} = 'running'`),
    index('video_experiments_video_idx').on(table.videoId, table.startedAt.desc()),
    check('video_experiments_kind_check', sql`${table.kind} IN (${listOf(EXPERIMENT_KINDS)})`),
    check(
      'video_experiments_status_check',
      sql`${table.status} IN (${listOf(EXPERIMENT_STATUSES)})`
    ),
    check(
      'video_experiments_winner_check',
      sql`${table.winnerVariantId} IS NULL OR ${table.winnerVariantId} IN (${listOf(EXPERIMENT_VARIANT_IDS)})`
    ),
  ]
);

export const videoExperimentStats = pgTable(
  'video_experiment_stats',
  {
    experimentId: uuid('experiment_id')
      .notNull()
      .references(() => videoExperiments.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').$type<ExperimentVariantId>().notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    impressions: integer('impressions').notNull().default(0),
    starts: integer('starts').notNull().default(0),
    watchSeconds: bigint('watch_seconds', { mode: 'number' }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.experimentId, table.variantId, table.day] }),
    check(
      'video_experiment_stats_variant_check',
      sql`${table.variantId} IN (${listOf(EXPERIMENT_VARIANT_IDS)})`
    ),
  ]
);
