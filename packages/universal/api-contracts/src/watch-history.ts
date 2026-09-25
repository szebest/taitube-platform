import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { ChannelCardSchema } from './playlists';
import { VideoSummarySchema } from './video-resource';

const PLAYHEAD_REASONS = ['heartbeat', 'pause', 'ended'] as const;

const VideoIdParamSchema = z.object({ videoId: z.string().uuid() });

const WatchProgressSchema = z.object({
  videoId: z.string().uuid(),
  progressSeconds: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive(),
  progressPercent: z.number().int().min(0).max(100),
  completed: z.boolean().describe('Watched to 92 % or further'),
  resumeAtSeconds: z.number().int().nonnegative().describe('0 for a completed video'),
  watchedAt: z.string().describe('ISO 8601 timestamp of the playhead'),
});

const WatchHistoryItemSchema = WatchProgressSchema.extend({
  id: z.string().uuid(),
  video: VideoSummarySchema,
  channel: ChannelCardSchema.nullable(),
});

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
} as const;

export const recordWatchProgress = defineEndpoint({
  method: 'POST',
  path: '/v1/me/history',
  tag: 'Watch history',
  summary: 'Save a playback position',
  description:
    'A heartbeat is buffered in Redis for 7 days and reaches the history on the first beat of a session; a pause or the end is written through with ON CONFLICT (user_id, video_id) DO UPDATE.',
  body: z.object({
    videoId: z.string().uuid(),
    progressSeconds: z.number().int().nonnegative(),
    durationSeconds: z.number().int().positive(),
    reason: z
      .enum(PLAYHEAD_REASONS)
      .default('pause')
      .describe('heartbeat: every few seconds of playback; pause and ended: written through'),
  }),
  status: 200,
  result: WatchProgressSchema,
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.VIDEO_NOT_FOUND] },
});

export const getWatchProgress = defineEndpoint({
  method: 'GET',
  path: '/v1/me/history/:videoId',
  tag: 'Watch history',
  summary: 'Where to resume a video',
  description: 'The latest playhead, from the Redis buffer when it holds one.',
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({ playhead: WatchProgressSchema.nullable() }),
  errors: AUTHENTICATED,
});

export const listWatchHistory = defineEndpoint({
  method: 'GET',
  path: '/v1/me/history',
  tag: 'Watch history',
  summary: 'List my watch history',
  description:
    'Videos the caller watched, newest first, keyset-paginated on (watched_at, id). A video they may no longer watch drops out.',
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(WatchHistoryItemSchema), nextCursor: z.string().nullable() }),
  errors: { ...AUTHENTICATED, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const clearWatchHistory = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/history',
  tag: 'Watch history',
  summary: 'Clear my watch history',
  description: 'Removes every entry and every buffered playhead.',
  status: 204,
  result: z.null().describe('History cleared'),
  errors: { 401: [ErrorCodes.UNAUTHORIZED] },
});

export const removeWatchHistoryEntry = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/history/:videoId',
  tag: 'Watch history',
  summary: 'Remove a video from my watch history',
  description:
    'Removes the entry and its buffered playhead. Removing an absent entry changes nothing.',
  params: VideoIdParamSchema,
  status: 204,
  result: z.null().describe('Entry removed'),
  errors: AUTHENTICATED,
});

export type WatchProgressView = z.infer<typeof WatchProgressSchema>;
export type WatchHistoryItemView = z.infer<typeof WatchHistoryItemSchema>;
export type RecordWatchProgressBody = z.infer<typeof recordWatchProgress.body>;
