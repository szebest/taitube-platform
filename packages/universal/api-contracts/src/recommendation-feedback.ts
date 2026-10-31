import { RECOMMENDATION_FEEDBACK_KINDS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { VideoSummarySchema } from './video-resource';

const VideoTargetSchema = z.object({
  kind: z.literal('not_interested'),
  videoId: z.uuid().describe('The video to stop recommending'),
});

const ChannelTargetSchema = z.object({
  kind: z.literal('hide_channel'),
  channelId: z.uuid().describe('The channel to stop recommending'),
});

const FeedbackFieldsSchema = {
  id: z.uuid(),
  createdAt: z.string().describe('ISO 8601 timestamp of when the caller gave the feedback'),
};

const FeedbackBodySchema = z.discriminatedUnion('kind', [VideoTargetSchema, ChannelTargetSchema]);

const FeedbackSchema = z.discriminatedUnion('kind', [
  VideoTargetSchema.extend(FeedbackFieldsSchema),
  ChannelTargetSchema.extend(FeedbackFieldsSchema),
]);

const FeedbackItemSchema = z.discriminatedUnion('kind', [
  VideoTargetSchema.extend(FeedbackFieldsSchema).extend({
    video: VideoSummarySchema.nullable().describe(
      'Null once the caller may no longer watch the video; the row can still be undone'
    ),
    channel: ChannelCardSchema.nullable().describe('The channel of the video'),
  }),
  ChannelTargetSchema.extend(FeedbackFieldsSchema).extend({
    channel: ChannelCardSchema.nullable(),
  }),
]);

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
} as const;

export const putRecommendationFeedback = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/recommendation-feedback',
  tag: 'Recommendation feedback',
  summary: 'Stop recommending a video or a channel',
  description:
    'Idempotent: the same target answers the row that is already there. The home shelves and "More like this" leave out what the caller marked; the feed, search, channel pages, playlists and the subscriptions feed do not. Stored even while privacy.historyPaused is set, because it is an explicit act. The caller keeps their newest 1000 rows, and a write past that removes the oldest. Drops the cached home page.',
  body: FeedbackBodySchema,
  status: 200,
  result: FeedbackSchema,
  errors: {
    ...AUTHENTICATED,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const removeRecommendationFeedback = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/recommendation-feedback/:id',
  tag: 'Recommendation feedback',
  summary: 'Undo recommendation feedback',
  description:
    'Answers 404 for a row that is not the caller own. The video or channel is recommended again from the next home build.',
  params: z.object({ id: z.uuid() }),
  status: 204,
  result: z.null().describe('Feedback removed'),
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND] },
});

export const listRecommendationFeedback = defineEndpoint({
  method: 'GET',
  path: '/v1/me/recommendation-feedback',
  tag: 'Recommendation feedback',
  summary: 'List what I stopped recommending',
  description:
    'Newest first, keyset-paginated on (created_at, id), with the video or channel of each row.',
  query: KeysetQuerySchema.extend({
    kind: z.enum(RECOMMENDATION_FEEDBACK_KINDS).optional().describe('Only rows of this kind'),
  }),
  status: 200,
  result: z.object({ items: z.array(FeedbackItemSchema), nextCursor: z.string().nullable() }),
  errors: { ...AUTHENTICATED, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export type RecommendationFeedbackBody = z.infer<typeof FeedbackBodySchema>;
export type RecommendationFeedbackView = z.infer<typeof FeedbackSchema>;
export type RecommendationFeedbackItemView = z.infer<typeof FeedbackItemSchema>;
