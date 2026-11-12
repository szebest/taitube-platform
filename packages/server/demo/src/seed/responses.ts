import { z } from 'zod';

const Nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const AccountSchema = z.object({
  id: z.string(),
  role: z.string(),
  channel: z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string(),
    bio: Nullable(z.string()),
    brandColor: Nullable(z.string()),
    avatarUrl: Nullable(z.string()),
    bannerUrl: Nullable(z.string()),
    handleChangeAvailableAt: Nullable(z.string()),
  }),
});

export const CategoryListSchema = z.array(z.object({ id: z.string(), slug: z.string() }));

export const CreatedCategorySchema = z.object({ id: z.string(), slug: z.string() });

export const VideoSummarySchema = z.object({
  id: z.string(),
  title: Nullable(z.string()),
  description: Nullable(z.string()),
  status: z.string(),
  visibility: z.string(),
  format: z.string(),
  durationMs: z.number().optional(),
  categoryId: Nullable(z.string()),
  tags: z.array(z.string()).optional(),
  version: z.number().optional(),
});

export const CreatorLibrarySchema = z.object({
  items: z.array(VideoSummarySchema),
  nextCursor: z.string().nullable(),
});

export const VideoDetailSchema = VideoSummarySchema.extend({
  version: z.number(),
  playbackUrl: z.string().optional(),
  posterUrl: z.string().optional(),
});

export const CommentSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  isPinned: z.boolean(),
  heartedByCreator: z.boolean(),
  replyCount: z.number(),
  author: z.object({ userId: z.string() }).optional(),
});

export const CommentPageSchema = z.object({
  items: z.array(CommentSchema),
  nextCursor: z.string().nullable(),
});

export const IdSchema = z.object({ id: z.string() });

export const OwnedPlaylistsSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string(), isSystem: z.boolean() })),
});

export const PlaylistSchema = z.object({
  id: z.string(),
  items: z.array(z.object({ videoId: z.string() })),
});

export const SubscriptionStateSchema = z.object({ subscribed: z.boolean() });

export const SearchesPageSchema = z.object({
  items: z.array(z.object({ id: z.string(), query: z.string() })),
  nextCursor: z.string().nullable(),
});

export const CaptionListSchema = z.object({
  tracks: z.array(z.object({ language: z.string().nullable().optional() })),
});

export const PreparedImageSchema = z.object({
  uploadId: z.string(),
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
});

export const AnySchema = z.unknown();
