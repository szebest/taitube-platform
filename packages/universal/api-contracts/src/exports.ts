import {
  type ChannelAnalyticsExportRow,
  type CommentExportRow,
  DATA_EXPORT_FORMATS,
  DATA_EXPORT_KINDS,
  DATA_EXPORT_LIMITS,
  DATA_EXPORT_STATUSES,
  type DataExportKind,
  DISCLOSURES,
  MODERATION_STATES,
  VIDEO_STATUSES,
  VIDEO_VISIBILITIES,
  type VideoAnalyticsExportRow,
  type VideoExportRow,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const DaySchema = z.iso.date().describe('UTC calendar day, YYYY-MM-DD');

const VideoAnalyticsRowSchema = z
  .object({
    videoId: z.uuid(),
    title: z.string(),
    series: z.enum(['daily', 'retention']).describe('Which of the two series the row belongs to'),
    day: DaySchema.nullable().describe('The day of a daily row; null on a retention row'),
    views: z.number().int().nullable().describe('Views counted that day; null on a retention row'),
    watchSeconds: z
      .number()
      .nullable()
      .describe('Seconds watched that day; null on a retention row'),
    percent: z.number().int().nullable().describe('How far into the video; null on a daily row'),
    viewers: z
      .number()
      .int()
      .nullable()
      .describe('Views that reached `percent`; null on a daily row'),
  })
  .describe(
    'One video and day, or one step of a video retention curve'
  ) satisfies z.ZodType<VideoAnalyticsExportRow>;

const ChannelAnalyticsRowSchema = z
  .object({
    day: DaySchema,
    views: z.number().int(),
    watchSeconds: z.number(),
    subscribersGained: z.number().int(),
    subscribersLost: z.number().int(),
  })
  .describe('One day of the whole channel') satisfies z.ZodType<ChannelAnalyticsExportRow>;

const CommentRowSchema = z
  .object({
    commentId: z.uuid(),
    videoId: z.uuid().describe('The video the comment is on'),
    videoTitle: z.string(),
    parentId: z.uuid().nullable().describe('The comment it replies to; null for a thread'),
    authorHandle: z
      .string()
      .nullable()
      .describe('The public handle; null when the author has no channel'),
    authorDisplayName: z.string().nullable(),
    text: z.string(),
    createdAt: z.iso.datetime(),
    likes: z.number().int(),
    hearted: z.boolean().describe('Whether the creator hearted it'),
    pinned: z.boolean(),
    moderationState: z.enum(MODERATION_STATES),
    disclosure: z.enum(DISCLOSURES).nullable().describe('How the moderation action was disclosed'),
  })
  .describe(
    'One comment on one of the channel videos; removed comments are not exported'
  ) satisfies z.ZodType<CommentExportRow>;

const VideoRowSchema = z
  .object({
    videoId: z.uuid(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).describe('In CSV, one cell joined by `|`'),
    category: z.string().nullable().describe('The category slug'),
    visibility: z.enum(VIDEO_VISIBILITIES),
    status: z.enum(VIDEO_STATUSES),
    durationMs: z.number().int().nullable(),
    views: z.number().int(),
    likes: z.number().int(),
    dislikes: z.number().int(),
    comments: z.number().int(),
    createdAt: z.iso.datetime(),
    readyAt: z.iso.datetime().nullable(),
  })
  .describe(
    'One video of the channel with its metadata and counts'
  ) satisfies z.ZodType<VideoExportRow>;

/** The row each kind writes, in column order: a CSV header is the keys, a JSON file an array of these. */
const EXPORT_ROW_SCHEMAS = {
  video_analytics: VideoAnalyticsRowSchema,
  channel_analytics: ChannelAnalyticsRowSchema,
  comments: CommentRowSchema,
  videos: VideoRowSchema,
} as const satisfies Record<DataExportKind, z.ZodObject>;

export function exportColumns(kind: DataExportKind): string[] {
  return Object.keys(EXPORT_ROW_SCHEMAS[kind].shape);
}

const ExportParamsSchema = z
  .object({
    from: DaySchema.optional().describe('First day included; absent reaches the oldest data'),
    to: DaySchema.optional().describe('Last day included; absent reaches today'),
  })
  .refine(({ from, to }) => !(from && to) || from <= to, {
    error: '`from` must not be after `to`',
    path: ['from'],
  })
  .describe(
    'Narrows analytics to the days, comments and videos to those made on the days; a retention curve has no day and is always whole'
  );

const ExportIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid export ID format' }) });

const CreateExportBodySchema = z.object({
  kind: z.enum(DATA_EXPORT_KINDS),
  format: z.enum(DATA_EXPORT_FORMATS).describe('RFC 4180 CSV with a header, or one JSON array'),
  params: ExportParamsSchema.default({}),
});

const DataExportSchema = z.object({
  id: z.uuid(),
  kind: z.enum(DATA_EXPORT_KINDS),
  format: z.enum(DATA_EXPORT_FORMATS),
  params: z.object({ from: DaySchema.optional(), to: DaySchema.optional() }),
  status: z.enum(DATA_EXPORT_STATUSES),
  requestedBy: z.uuid().nullable().describe('null once the requester deleted their account'),
  rowCount: z.number().int().nonnegative().nullable().describe('Set once the file is ready'),
  failure: z.string().nullable().describe('Why the job gave up, when it did'),
  expiresAt: z.iso.datetime().nullable().describe('When the file is purged; set once it is ready'),
  createdAt: z.iso.datetime(),
});

const DataExportDetailSchema = DataExportSchema.extend({
  downloadUrl: z
    .string()
    .nullable()
    .describe('A short-lived presigned GET for the file while it is ready; null otherwise'),
});

const DataExportPageSchema = z.object({
  items: z.array(DataExportSchema),
  nextCursor: z.string().nullable(),
});

const SIGNED_IN = { 401: [ErrorCodes.UNAUTHORIZED] } as const;
const VALIDATED = { ...SIGNED_IN, 400: [ErrorCodes.VALIDATION_FAILED] } as const;
const TAG = 'Channel exports';
const WHO =
  'The owner and managers reach every kind, an analytics viewer the analytics kinds only.';

export const createChannelExport = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/exports',
  scope: 'exports:create',
  channelScoped: true,
  tag: TAG,
  summary: 'Request an export of channel data',
  description: `Queues a job that writes every row of \`kind\` to a private file; \`export.ready\` on \`GET /v1/me/events\` and as a webhook says when it can be downloaded. One running export per channel, ${DATA_EXPORT_LIMITS.perDay} a day, at most ${DATA_EXPORT_LIMITS.maxRows} rows or 500 MB; the file is kept ${DATA_EXPORT_LIMITS.ttlDays} days. A CSV cell that starts with \`=\`, \`+\`, \`-\`, \`@\` or a tab gets a leading apostrophe, so a spreadsheet reads it as text. ${WHO}`,
  body: CreateExportBodySchema,
  status: 202,
  result: DataExportSchema,
  errors: {
    ...VALIDATED,
    409: [ErrorCodes.EXPORT_IN_PROGRESS],
    429: [ErrorCodes.EXPORT_DAILY_LIMIT],
  },
});

export const listChannelExports = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/exports',
  scope: 'exports:read',
  channelScoped: true,
  tag: TAG,
  summary: 'List the channel exports',
  description: `Keyset-paginated, newest first, only the kinds the caller may export. ${WHO}`,
  query: KeysetQuerySchema,
  status: 200,
  result: DataExportPageSchema,
  errors: { ...SIGNED_IN, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const getChannelExport = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/exports/:id',
  scope: 'exports:read',
  channelScoped: true,
  tag: TAG,
  summary: 'Read one export',
  description: `The export with a presigned GET for its file while it is ready. ${WHO}`,
  params: ExportIdParamSchema,
  status: 200,
  result: DataExportDetailSchema,
  errors: { ...VALIDATED, 404: [ErrorCodes.EXPORT_NOT_FOUND] },
});

export const deleteChannelExport = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/exports/:id',
  scope: 'exports:create',
  channelScoped: true,
  tag: TAG,
  summary: 'Delete an export and its file',
  description: `A job still writing it finds the export gone and throws its file away. ${WHO}`,
  params: ExportIdParamSchema,
  status: 204,
  result: z.null().describe('Export deleted'),
  errors: { ...VALIDATED, 404: [ErrorCodes.EXPORT_NOT_FOUND] },
});

export type DataExportView = z.infer<typeof DataExportSchema>;
export type DataExportDetailView = z.infer<typeof DataExportDetailSchema>;
export type DataExportPageView = z.infer<typeof DataExportPageSchema>;
export type CreateExportBody = z.infer<typeof CreateExportBodySchema>;
