import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { PartyQueueSchema, WatchPartyIdParamSchema } from './watch-party-resource';

const QueueItemParamsSchema = WatchPartyIdParamSchema.extend({
  itemId: z.uuid({ error: 'Invalid queue item ID format' }),
});

export const getWatchPartyQueue = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/queue',
  tag: 'Watch parties',
  summary: 'Read the queue',
  description: 'The shared queue in play order, for members.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  status: 200,
  result: PartyQueueSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const addToWatchPartyQueue = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/queue',
  tag: 'Watch parties',
  summary: 'Add to the queue',
  description:
    'Appends a video, or a playlist copied once (queue.add; 3 pending items each without queue.reorder). Sockets get a queue frame.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  body: z.union([
    z.object({ videoId: z.uuid(), startMs: z.number().int().nonnegative().optional() }),
    z.object({ playlistId: z.uuid() }),
  ]),
  status: 201,
  result: PartyQueueSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_QUEUE_FULL],
    422: [ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE],
  },
});

export const moveWatchPartyQueueItem = defineEndpoint({
  method: 'PATCH',
  path: '/v1/watch-parties/:id/queue/:itemId',
  tag: 'Watch parties',
  summary: 'Move a queue item',
  description: 'Puts an item at a new index (queue.reorder).',
  partyGuest: true,
  params: QueueItemParamsSchema,
  body: z.object({ toIndex: z.number().int().nonnegative() }),
  status: 200,
  result: PartyQueueSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const removeWatchPartyQueueItem = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/queue/:itemId',
  tag: 'Watch parties',
  summary: 'Remove a queue item',
  description: "Removes anyone's item (queue.remove), or one's own pending item (queue.add).",
  partyGuest: true,
  params: QueueItemParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});
