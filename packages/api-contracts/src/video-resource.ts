import { z } from 'zod';

export const VIDEO_STATUSES = [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED',
  'ABANDONED',
  'DELETED',
] as const;

export const VIDEO_VISIBILITIES = ['private', 'unlisted', 'public'] as const;

export const VideoStatusSchema = z
  .enum(VIDEO_STATUSES)
  .describe('Current pipeline lifecycle state');

export const VideoVisibilitySchema = z.enum(VIDEO_VISIBILITIES).describe('Access visibility level');

export const VideoLadderEntrySchema = z
  .object({
    name: z.string().describe('Rendition name'),
    width: z.number().describe('Width in pixels'),
    height: z.number().describe('Height in pixels'),
    videoKbps: z.number().optional().describe('Video bitrate in kbps'),
    audioKbps: z.number().optional().describe('Audio bitrate in kbps'),
  })
  .describe('Transcoding ladder entry');

export const VideoProgressSchema = z
  .object({
    overall: z.number().min(0).max(100).describe('Overall encoding progress percentage 0-100'),
    byRendition: z
      .record(z.number().min(0).max(100))
      .describe('Encoding progress per rendition name'),
  })
  .describe('Encoding progress');

export const VideoErrorSchema = z
  .object({
    code: z.string().describe('Machine-readable failure error code'),
    message: z.string().describe('Human-readable error details'),
  })
  .describe('Failure error details');

export const RenditionViewSchema = z.object({
  name: z.string().describe('Rendition name (e.g. 1080p, 720p, 480p)'),
  status: z.string().describe('Rendition encoding status (PENDING, RUNNING, DONE, FAILED)'),
  playlistUrl: z.string().optional().describe('URL to the rendition HLS playlist index.m3u8'),
});

export const VideoSchema = z.object({
  id: z.string().uuid().describe('Video UUIDv7 identifier'),
  title: z.string().nullable().describe('Video title'),
  description: z.string().nullable().describe('Video description'),
  visibility: VideoVisibilitySchema,
  status: VideoStatusSchema,
  progress: VideoProgressSchema,
  durationMs: z.number().optional().describe('Video duration in milliseconds'),
  width: z.number().optional().describe('Source video frame width in pixels'),
  height: z.number().optional().describe('Source video frame height in pixels'),
  fps: z.number().optional().describe('Source video frame rate'),
  ladder: z
    .array(VideoLadderEntrySchema)
    .optional()
    .describe('Transcoding ladder configurations computed from probe'),
  renditions: z.array(RenditionViewSchema).describe('List of renditions for this video'),
  playbackUrl: z.string().optional().describe('Public CDN playback URL to master.m3u8 (PRD OQ-2)'),
  posterUrl: z.string().optional().describe('Public CDN URL to poster image'),
  spriteUrl: z.string().optional().describe('Public CDN URL to thumbnail sprite sheet'),
  spriteVttUrl: z.string().optional().describe('Public CDN URL to WebVTT thumbnail cue sheet'),
  likesCount: z.number().int().nonnegative().default(0).describe('Total like reactions count'),
  dislikesCount: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe('Total dislike reactions count'),
  error: VideoErrorSchema.optional(),
  version: z.number().int().nonnegative().describe('Optimistic locking record version'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  readyAt: z.string().optional().describe('ISO 8601 ready transition timestamp'),
});

export const VideoSummarySchema = z.object({
  id: z.string().uuid().describe('Video UUIDv7 identifier'),
  title: z.string().nullable().describe('Video title'),
  description: z.string().nullable().describe('Video description'),
  visibility: VideoVisibilitySchema,
  status: VideoStatusSchema,
  durationMs: z.number().optional().describe('Video duration in milliseconds'),
  posterUrl: z.string().optional().describe('Public CDN URL to poster thumbnail (PRD US-12)'),
  playbackUrl: z.string().optional().describe('Public CDN playback URL to master.m3u8 if ready'),
  viewsCount: z.number().optional().describe('Total view count'),
  likesCount: z.number().int().nonnegative().optional().describe('Total like reactions count'),
  dislikesCount: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Total dislike reactions count'),
  categoryId: z.string().uuid().nullable().optional().describe('Category UUID identifier'),
  version: z.number().int().nonnegative().describe('Optimistic locking record version'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  readyAt: z.string().optional().describe('ISO 8601 ready timestamp if ready'),
});

export const VideoListResponseSchema = z.object({
  items: z.array(VideoSummarySchema).describe('Page of video summary items'),
  nextCursor: z
    .string()
    .nullable()
    .describe('Opaque base64url keyset pagination cursor for next page'),
});

export const VideoIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid video ID format' }),
});

export type VideoStatus = z.infer<typeof VideoStatusSchema>;
export type VideoVisibility = z.infer<typeof VideoVisibilitySchema>;
export type VideoLadderEntry = z.infer<typeof VideoLadderEntrySchema>;
export type VideoProgress = z.infer<typeof VideoProgressSchema>;
export type VideoRendition = z.infer<typeof RenditionViewSchema>;
export type Video = z.infer<typeof VideoSchema>;
export type VideoSummary = z.infer<typeof VideoSummarySchema>;
export type VideoListResponse = z.infer<typeof VideoListResponseSchema>;
