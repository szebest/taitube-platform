import { ErrorCodes } from '@vp/errors';
import { PICK_NOTE_MAX_LENGTH } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoSummarySchema } from './video-resource';

const PickIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid pick ID format' }) });

const NoteSchema = z
  .string()
  .nullable()
  .describe(`The editorial line, up to ${PICK_NOTE_MAX_LENGTH} characters once tidied`);

const WindowStartSchema = z.iso.datetime({ offset: true }).describe('When the pick starts');
const WindowEndSchema = z.iso
  .datetime({ offset: true })
  .describe('When the pick ends: after it starts and still ahead of the server clock');

const PickSchema = z.object({
  id: z.uuid().describe('Pick UUIDv7 identifier'),
  videoId: z.uuid().describe('The picked video'),
  startsAt: z.iso.datetime().describe('ISO 8601 start of the window, inclusive'),
  endsAt: z.iso.datetime().describe('ISO 8601 end of the window, exclusive'),
  note: NoteSchema,
  createdBy: z.uuid().describe('The admin who scheduled it'),
  createdAt: z.iso.datetime().describe('ISO 8601 creation timestamp'),
  video: VideoSummarySchema.describe('The picked video, as it is now, whatever its state'),
});

const PickListSchema = z.object({
  items: z.array(PickSchema).describe('Picks touching the range, earliest first'),
});

const ListPicksQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional().describe('Start of the range; defaults to now'),
  to: z.iso
    .datetime({ offset: true })
    .optional()
    .describe('End of the range; defaults to 30 days after the start'),
});

const CreatePickBodySchema = z.object({
  videoId: z.uuid().describe('A public, ready video'),
  startsAt: WindowStartSchema,
  endsAt: WindowEndSchema,
  note: z
    .string()
    .nullish()
    .describe(`Optional editorial line, up to ${PICK_NOTE_MAX_LENGTH} characters`),
});

const UpdatePickBodySchema = z
  .object({
    videoId: z.uuid().optional().describe('A public, ready video'),
    startsAt: WindowStartSchema.optional(),
    endsAt: WindowEndSchema.optional(),
    note: z.string().nullish().describe('Replaces the note; null clears it'),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'At least one field must be provided for update',
  });

export const CurrentPickSchema = z.object({
  source: z
    .enum(['scheduled', 'fallback'])
    .describe('scheduled: an editor picked it; fallback: the top trending video, nobody picked'),
  video: VideoSummarySchema,
  note: z.string().nullable().describe('Null for a fallback'),
  startsAt: z.iso.datetime().nullable().describe('Null for a fallback'),
  endsAt: z.iso.datetime().nullable().describe('When the pick gives way; null for a fallback'),
});

export const getCurrentPick = defineEndpoint({
  method: 'GET',
  path: '/v1/picks/current',
  tag: 'Picks',
  summary: 'Pick of the day',
  description:
    'Open to anyone. The scheduled pick whose window holds now, while its video is still public and ready, with its note and when it ends. Otherwise the fallback: the top trending video, with no note and no window. Cached until the pick ends; scheduling, editing or cancelling a pick drops the cache. 404 only when nothing is scheduled and no video is trending.',
  anonymous: true,
  status: 200,
  result: CurrentPickSchema,
  errors: {
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const listAdminPicks = defineEndpoint({
  method: 'GET',
  path: '/v1/admin/picks',
  tag: 'Admin',
  summary: 'List picks',
  description:
    'Admin only. The picks whose window touches the range (the next 30 days by default), earliest first, each with its video. Never cached.',
  query: ListPicksQuerySchema,
  status: 200,
  result: PickListSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

export const createPick = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/picks',
  tag: 'Admin',
  summary: 'Schedule a pick',
  description:
    'Admin only. Picks a public, ready video for a window that is current or ahead and overlaps no other pick (windows are half-open: one may start where another ends). Drops the current-pick cache.',
  body: CreatePickBodySchema,
  status: 201,
  result: PickSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.PICK_WINDOW_OVERLAP],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const updatePick = defineEndpoint({
  method: 'PATCH',
  path: '/v1/admin/picks/:id',
  tag: 'Admin',
  summary: 'Edit a pick',
  description:
    'Admin only. Changes the video, the window or the note; an omitted field keeps its value and the same rules as scheduling apply. Drops the current-pick cache.',
  params: PickIdParamSchema,
  body: UpdatePickBodySchema,
  status: 200,
  result: PickSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.PICK_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.PICK_WINDOW_OVERLAP],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const cancelPick = defineEndpoint({
  method: 'DELETE',
  path: '/v1/admin/picks/:id',
  tag: 'Admin',
  summary: 'Cancel a pick',
  description:
    'Admin only. Removes the pick, also one that is running. Drops the current-pick cache.',
  params: PickIdParamSchema,
  status: 204,
  result: z.null().describe('Pick cancelled'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.PICK_NOT_FOUND],
  },
});

export type PickView = z.infer<typeof PickSchema>;
export type PickListView = z.infer<typeof PickListSchema>;
export type CurrentPickView = z.infer<typeof CurrentPickSchema>;
export type CreatePickBody = z.infer<typeof CreatePickBodySchema>;
export type UpdatePickBody = z.infer<typeof UpdatePickBodySchema>;
export type ListPicksQuery = z.infer<typeof ListPicksQuerySchema>;
