import { ENTITY_REVISION_KEEP, LAYOUT_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelLayoutSchema } from './channel-layout';
import { ChannelPageQuerySchema, ChannelPageSchema } from './channel-page';
import { defineEndpoint } from './endpoint';
import { CursorSchema, OptionalPageLimitSchema } from './pagination';

const TAG = 'Channel page';

const WHO =
  'Owner, manager and editor of the channel the request acts on; a moderator and an analyst are refused.';

const LAYOUT_ERRORS = [
  ErrorCodes.VALIDATION_FAILED,
  ErrorCodes.LAYOUT_LIMIT_EXCEEDED,
  ErrorCodes.LAYOUT_MARKDOWN_INVALID,
  ErrorCodes.LAYOUT_SLUG_INVALID,
  ErrorCodes.LAYOUT_STRUCTURE_INVALID,
] as const;

const ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN, ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED],
} as const;

const DraftSchema = z
  .strictObject({
    document: ChannelLayoutSchema,
    version: z.number().int().nonnegative().describe('0 until the first save'),
    publishedRevision: z.number().int().nullable().describe('The live revision; null for none'),
    updatedBy: z.uuid().nullable(),
    updatedAt: z.iso.datetime().nullable(),
  })
  .meta({
    id: 'ChannelPageDraft',
    description:
      'The one draft of the channel page; before the first save it is the published layout, else the default one',
  });

const PublishedSchema = z
  .strictObject({
    version: z.number().int().positive(),
    note: z.string().nullable(),
    authorUserId: z.uuid().nullable(),
    restoredFromVersion: z.number().int().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'ChannelPageRevision', description: 'One published layout of the channel page' });

const RevisionPageSchema = z.object({
  items: z.array(PublishedSchema),
  nextCursor: z.string().nullable(),
});

const ScheduleSchema = z
  .strictObject({
    id: z.uuid(),
    publishAt: z.iso.datetime(),
    status: z.enum(['pending', 'applied', 'cancelled']),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'ChannelPageSchedule', description: 'A layout queued to go live at a time' });

const ScheduleParamSchema = z.object({ id: z.uuid() });
const RevisionParamSchema = z.object({ id: z.uuid() });

export const getChannelPageDraft = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/page/draft',
  channelScoped: true,
  tag: TAG,
  summary: 'Read the draft of the channel page',
  description: WHO,
  status: 200,
  result: DraftSchema,
  errors: ERRORS,
});

export const saveChannelPageDraft = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/page/draft',
  channelScoped: true,
  tag: TAG,
  summary: 'Save the draft of the channel page',
  description: `Replaces the draft under the version the caller read, so two members saving at once cannot overwrite each other: the second gets 409 VERSION_CONFLICT. The document is checked for shape, caps (${LAYOUT_LIMITS.tabs} tabs, ${LAYOUT_LIMITS.customTabs} custom, ${LAYOUT_LIMITS.sectionsPerTab} sections a tab, ${LAYOUT_LIMITS.sections} in all, ${LAYOUT_LIMITS.pickedItems} picked items, 128 KB), tab structure, slugs and rich text; what it points at is checked on publish. ${WHO}`,
  body: z.object({ document: ChannelLayoutSchema, version: z.number().int().nonnegative() }),
  status: 200,
  result: DraftSchema,
  errors: {
    ...ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: LAYOUT_ERRORS,
  },
});

export const publishChannelPage = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/page/publish',
  channelScoped: true,
  tag: TAG,
  summary: 'Publish the draft of the channel page',
  description: `Validates the draft against the live data (every picked video, playlist and channel exists, is public and belongs where it must) and appends a revision with an audit entry in one transaction; the last ${ENTITY_REVISION_KEEP} revisions are kept. ${WHO}`,
  body: z.object({
    version: z.number().int().positive().describe('The draft version being published'),
    note: z.string().trim().max(200).nullable().optional(),
  }),
  status: 200,
  result: PublishedSchema,
  errors: {
    ...ERRORS,
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [...LAYOUT_ERRORS, ErrorCodes.LAYOUT_REFERENCE_INVALID],
  },
});

export const listChannelPageSchedules = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/page/schedule',
  channelScoped: true,
  tag: TAG,
  summary: 'List the pending layout schedules',
  description: WHO,
  status: 200,
  result: z.object({ items: z.array(ScheduleSchema) }),
  errors: ERRORS,
});

export const scheduleChannelPage = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/page/schedule',
  channelScoped: true,
  tag: TAG,
  summary: 'Queue a layout to go live later',
  description: `Snapshots the draft, or the published layout for a scheduled return, and queues it for \`publishAt\`. A housekeeping task applies it once with a compare-and-set on its status, however often it runs. ${WHO}`,
  body: z.object({
    publishAt: z.iso.datetime(),
    source: z.enum(['draft', 'published']),
  }),
  status: 201,
  result: ScheduleSchema,
  errors: {
    ...ERRORS,
    404: [ErrorCodes.REVISION_NOT_FOUND],
    422: [
      ...LAYOUT_ERRORS,
      ErrorCodes.LAYOUT_REFERENCE_INVALID,
      ErrorCodes.LAYOUT_SCHEDULE_INVALID,
    ],
  },
});

export const cancelChannelPageSchedule = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/page/schedule/:id',
  channelScoped: true,
  tag: TAG,
  summary: 'Cancel a queued layout',
  description: `A schedule that already ran or was cancelled answers 404. ${WHO}`,
  params: ScheduleParamSchema,
  status: 200,
  result: ScheduleSchema,
  errors: { ...ERRORS, 404: [ErrorCodes.LAYOUT_SCHEDULE_NOT_FOUND] },
});

export const listChannelPageRevisions = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/page/revisions',
  channelScoped: true,
  tag: TAG,
  summary: 'List the published layouts of the channel page',
  description: `Newest first, keyset-paginated on the version. ${WHO}`,
  query: z.object({ cursor: CursorSchema.optional(), limit: OptionalPageLimitSchema }),
  status: 200,
  result: RevisionPageSchema,
  errors: { ...ERRORS, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const restoreChannelPageRevision = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/page/revisions/:id/restore',
  channelScoped: true,
  tag: TAG,
  summary: 'Publish an earlier layout again',
  description: `Appends a new revision from the snapshot, so history is never rewritten and the published layout is always the newest one. ${WHO}`,
  params: RevisionParamSchema,
  status: 200,
  result: PublishedSchema,
  errors: { ...ERRORS, 404: [ErrorCodes.REVISION_NOT_FOUND] },
});

export const previewChannelPage = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/page/preview',
  channelScoped: true,
  tag: TAG,
  summary: 'The draft, resolved as an audience would see it',
  description: `\`as\` switches the audience only and grants nothing. The answer is \`Cache-Control: no-store\` and never cached by the server. ${WHO}`,
  query: ChannelPageQuerySchema.extend({ as: z.enum(['visitor', 'subscriber']) }),
  status: 200,
  result: ChannelPageSchema,
  errors: { ...ERRORS, 404: [ErrorCodes.CHANNEL_NOT_FOUND] },
});

export type ChannelPageDraftView = z.infer<typeof DraftSchema>;
export type ChannelPageRevisionView = z.infer<typeof PublishedSchema>;
export type ChannelPageRevisionPageView = z.infer<typeof RevisionPageSchema>;
export type ChannelPageScheduleView = z.infer<typeof ScheduleSchema>;
