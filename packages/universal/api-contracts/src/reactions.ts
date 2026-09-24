import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const ReactionTypeSchema = z.enum(['LIKE', 'DISLIKE']).nullable();

const ReactionInputSchema = z.object({
  type: z
    .enum(['LIKE', 'DISLIKE', 'NONE'])
    .describe('Reaction type: LIKE, DISLIKE, or NONE to clear'),
});

const VideoReactionSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
  reaction: ReactionTypeSchema.describe('User reaction state: LIKE, DISLIKE, or null'),
  likesCount: z.number().int().nonnegative().describe('Current total likes count'),
  dislikesCount: z.number().int().nonnegative().describe('Current total dislikes count'),
});

const UserReactionSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
  reaction: ReactionTypeSchema.describe('Authenticated user reaction: LIKE, DISLIKE, or null'),
});

export const setReaction = defineEndpoint({
  method: 'PUT',
  path: '/v1/videos/:id/reactions',
  tag: 'Reactions',
  summary: 'Set or clear video reaction (LIKE / DISLIKE / NONE)',
  description:
    'Idempotently updates caller reaction. Atomically adjusts Postgres and Redis counters.',
  params: VideoIdParamSchema,
  body: ReactionInputSchema,
  status: 200,
  result: VideoReactionSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const getMyReaction = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/reactions/me',
  tag: 'Reactions',
  summary: 'Get authenticated caller reaction for a video',
  description: 'Returns authenticated caller reaction (LIKE, DISLIKE, or null if no reaction).',
  params: VideoIdParamSchema,
  status: 200,
  result: UserReactionSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export type ReactionInput = z.infer<typeof ReactionInputSchema>;
export type VideoReaction = z.infer<typeof VideoReactionSchema>;
export type UserReaction = z.infer<typeof UserReactionSchema>;
