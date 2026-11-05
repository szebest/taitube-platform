import { ErrorCodes } from '@vp/errors';
import { LIVE_CHAT_MESSAGE_BOUNDS } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { LiveChatModeSchema, LiveStreamIdParamSchema } from './live';
import { ProblemSchema } from './problem';

const LiveChatMessageSchema = z
  .object({
    id: z.uuid().describe('UUIDv7: a stream sorts its lines by id'),
    author: z.object({
      userId: z.uuid(),
      handle: z.string().nullable(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
    message: z.string(),
    offsetMs: z.number().int().nonnegative().describe('Where the line sits on the recording'),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'LiveChatMessage', description: 'One chat line' });

/** `ref` is the sender's own correlation id, echoed on the ack or the error a frame earns. */
const RefSchema = z.string().max(64).optional();

export const LiveChatClientFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('send'),
    ref: RefSchema,
    message: z.string().max(LIVE_CHAT_MESSAGE_BOUNDS.maxLength * 4),
  }),
  z.object({ type: z.literal('remove'), ref: RefSchema, id: z.uuid() }),
]);

/** What every socket on the stream hears, from whichever pod the change happened on. */
export const LiveChatBroadcastSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), message: LiveChatMessageSchema }),
  z.object({ type: z.literal('removed'), id: z.uuid() }),
  z.object({ type: z.literal('mode'), mode: LiveChatModeSchema }),
]);

/**
 * `fresh` sent the latest lines, `replayed` every line after `?after=`, `expired` could not (too many
 * followed), so the client replaces what it shows with the latest lines that follow.
 */
const LiveChatHelloSchema = z.object({
  type: z.literal('hello'),
  resume: z.enum(['fresh', 'replayed', 'expired']),
  mode: LiveChatModeSchema,
  canSend: z.boolean().describe('False without a ticket: the socket only reads'),
  canModerate: z.boolean(),
});

const LiveChatAckSchema = z.object({
  type: z.literal('ack'),
  ref: RefSchema,
  id: z.uuid().describe('The line sent or removed'),
});

const LiveChatErrorSchema = z.object({
  type: z.literal('error'),
  ref: RefSchema,
  problem: ProblemSchema,
});

const LiveChatServerFrameSchema = z
  .discriminatedUnion('type', [
    LiveChatHelloSchema,
    LiveChatAckSchema,
    LiveChatErrorSchema,
    ...LiveChatBroadcastSchema.options,
  ])
  .describe(
    'WebSocket text frames, each one JSON object: hello first, the backlog as message frames, then live ones'
  );

export const createLiveChatTicket = defineEndpoint({
  method: 'POST',
  path: '/v1/live/:id/chat/ticket',
  tag: 'Live',
  summary: 'Get a chat ticket',
  description:
    'A one-time ticket the chat socket opens with, for clients whose session cookie the API origin cannot read. It expires in seconds.',
  params: LiveStreamIdParamSchema,
  status: 201,
  result: z.object({ ticket: z.string(), expiresAt: z.iso.datetime() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.LIVE_STREAM_NOT_FOUND],
    503: [ErrorCodes.CACHE_UNAVAILABLE],
  },
});

const ChatSocketQuerySchema = z
  .object({
    ticket: z
      .string()
      .max(128)
      .optional()
      .describe('From the ticket endpoint; without one the socket only reads'),
    after: z
      .uuid()
      .optional()
      .describe('The last line this client has: the backlog resumes after it'),
  })
  .optional();

export const liveChatSocket = defineEndpoint({
  method: 'GET',
  path: '/v1/live/:id/chat',
  tag: 'Live',
  summary: 'Live chat socket',
  description:
    'Upgrades to a WebSocket. Clients send `send` and `remove` frames; every pod fans lines out through Redis. A refused upgrade answers with a Problem instead.',
  anonymous: true,
  socket: true,
  params: LiveStreamIdParamSchema,
  query: ChatSocketQuerySchema,
  status: 101,
  result: LiveChatServerFrameSchema,
  errors: {
    401: [ErrorCodes.LIVE_CHAT_TICKET_INVALID],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.LIVE_STREAM_NOT_FOUND],
    503: [ErrorCodes.CACHE_UNAVAILABLE, ErrorCodes.DATABASE_UNAVAILABLE],
  },
});

const ReplayQuerySchema = z
  .object({
    fromMs: z.coerce.number().int().nonnegative(),
    toMs: z.coerce.number().int().positive(),
  })
  .refine(({ fromMs, toMs }) => toMs > fromMs, {
    error: 'toMs must be after fromMs',
    path: ['toMs'],
  });

export const getLiveChatReplay = defineEndpoint({
  method: 'GET',
  path: '/v1/live/:id/chat/replay',
  tag: 'Live',
  summary: 'Replay live chat',
  description:
    'The lines posted between two offsets of the broadcast, in offset order, for a recording playing back. `fromMs` is inclusive and `toMs` exclusive; a full page means fetch on from the last offset.',
  anonymous: true,
  params: LiveStreamIdParamSchema,
  query: ReplayQuerySchema,
  status: 200,
  result: z.object({ items: z.array(LiveChatMessageSchema) }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.LIVE_STREAM_NOT_FOUND],
  },
});

export type LiveChatMessageView = z.infer<typeof LiveChatMessageSchema>;
export type LiveChatBroadcast = z.infer<typeof LiveChatBroadcastSchema>;
export type LiveChatServerFrame = z.infer<typeof LiveChatServerFrameSchema>;
