import { LIVE_CHAT_SLOW_MODE_MAX_SECONDS, LIVE_STREAM_STATUSES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { LiveChatModeSchema } from './live';
import { ProblemSchema } from './problem';

const RefSchema = z.string().max(64).optional();

export const LiveCompanionCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stop'), ref: RefSchema }),
  z.object({
    type: z.literal('chat.mode'),
    ref: RefSchema,
    slowModeSeconds: z.number().int().min(0).max(LIVE_CHAT_SLOW_MODE_MAX_SECONDS).optional(),
    subscribersOnly: z.boolean().optional(),
  }),
  z.object({ type: z.literal('marker'), ref: RefSchema, label: z.string().max(100).optional() }),
]);

const CompanionStreamSchema = z.object({
  id: z.uuid(),
  status: z.enum(LIVE_STREAM_STATUSES),
  chat: LiveChatModeSchema,
});

const LiveCompanionFrameSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('hello'), stream: CompanionStreamSchema }),
    z.object({
      type: z.literal('ack'),
      ref: RefSchema,
      command: z.enum(['stop', 'chat.mode', 'marker']),
      stream: CompanionStreamSchema,
    }),
    z.object({ type: z.literal('error'), ref: RefSchema, problem: ProblemSchema }),
  ])
  .describe(
    'WebSocket text frames, each one JSON object: hello first, then one ack or error per command'
  );

export const liveCompanionSocket = defineEndpoint({
  method: 'GET',
  path: '/v1/live/companion',
  tag: 'Live',
  summary: 'Stream Deck companion socket',
  description:
    'Upgrades to a WebSocket a Stream Deck or Bitfocus Companion drives: stop the broadcast, switch chat modes, drop a marker on the recording. The control token from the studio is the credential. Starting is OBS publishing, so there is no start command.',
  anonymous: true,
  socket: true,
  query: z.object({ token: z.string().min(1).max(128) }),
  status: 101,
  result: LiveCompanionFrameSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.LIVE_STREAM_NOT_FOUND],
  },
});

export type LiveCompanionCommand = z.infer<typeof LiveCompanionCommandSchema>;
export type LiveCompanionFrame = z.infer<typeof LiveCompanionFrameSchema>;
