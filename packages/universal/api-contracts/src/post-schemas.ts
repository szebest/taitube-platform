import { POST_KINDS } from '@vp/domain';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';

export const PostIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid post ID format' }),
});

const PostImageInputSchema = z.object({
  uploadId: z.uuid().describe('A ready post-image upload of the posting channel'),
  alt: z.string().describe('Alt text, 1-200 characters after trimming'),
});

export const PostPayloadSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('text'),
      text: z.string().describe('1-2000 characters of plain text'),
    }),
    z.object({
      kind: z.literal('images'),
      images: z.array(PostImageInputSchema).describe('1 to 4 images, in display order'),
      caption: z.string().nullable().describe('Up to 2000 characters'),
    }),
    z.object({
      kind: z.literal('poll'),
      question: z.string().describe('1-140 characters'),
      options: z.array(z.string()).describe('2 to 6 options of 1-60 characters'),
      closesAt: z.iso
        .datetime()
        .nullable()
        .describe('When voting ends, within 30 days; null keeps it open'),
    }),
    z.object({
      kind: z.literal('quiz'),
      question: z.string().describe('1-140 characters'),
      options: z.array(z.string()).describe('2 to 6 options of 1-60 characters'),
      closesAt: z.iso.datetime().nullable().describe('When answering ends, within 30 days'),
      correctIndex: z.number().int().describe('The index of the right option'),
      explanation: z.string().nullable().describe('Shown after answering, up to 300 characters'),
    }),
    z.object({
      kind: z.literal('video_share'),
      videoId: z.uuid().describe('A public, ready video'),
      comment: z.string().nullable().describe('Up to 500 characters'),
      startMs: z
        .number()
        .nullable()
        .describe('Where the card opens the video, in whole milliseconds'),
    }),
    z.object({
      kind: z.literal('playlist_share'),
      playlistId: z.uuid().describe('A public playlist'),
      comment: z.string().nullable().describe('Up to 500 characters'),
    }),
  ])
  .meta({ id: 'PostPayload', description: 'What the post says, by kind' });

const PostImageViewSchema = z.object({
  uploadId: z.uuid(),
  alt: z.string(),
  urls: z.object({ w640: z.string(), w1280: z.string() }),
});

const PostShareCardSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('video'),
      id: z.uuid(),
      title: z.string(),
      thumbnailUrl: z.string().nullable(),
      durationSeconds: z.number().int().nonnegative().nullable(),
    }),
    z.object({
      type: z.literal('playlist'),
      id: z.uuid(),
      title: z.string(),
      itemCount: z.number().int().nonnegative(),
    }),
    z.object({ type: z.literal('unavailable') }),
  ])
  .meta({
    id: 'PostShareCard',
    description:
      'What a shared video or playlist shows, or `unavailable` once it is gone or not public, and then nothing of it',
  });

const PollOptionViewSchema = z.object({
  text: z.string(),
  votes: z.number().int().nonnegative().nullable().describe('Null until results show'),
});

const PostBodySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string() }),
    z.object({
      kind: z.literal('images'),
      images: z
        .array(PostImageViewSchema)
        .describe('An image whose upload is not ready is left out'),
      caption: z.string().nullable(),
    }),
    z.object({
      kind: z.literal('poll'),
      question: z.string(),
      options: z.array(PollOptionViewSchema),
      closesAt: z.string().nullable(),
      closed: z.boolean(),
      votedIndex: z.number().int().nullable().describe('The option the viewer chose'),
      totalVotes: z.number().int().nonnegative().nullable().describe('Null until results show'),
    }),
    z.object({
      kind: z.literal('quiz'),
      question: z.string(),
      options: z.array(PollOptionViewSchema),
      closesAt: z.string().nullable(),
      closed: z.boolean(),
      votedIndex: z.number().int().nullable(),
      totalVotes: z.number().int().nonnegative().nullable(),
      correctIndex: z
        .number()
        .int()
        .nullable()
        .describe('Null until the viewer answered or it closed'),
      explanation: z.string().nullable().describe('Null until the viewer answered or it closed'),
    }),
    z.object({
      kind: z.literal('video_share'),
      comment: z.string().nullable(),
      startMs: z.number().int().nonnegative().nullable(),
      card: PostShareCardSchema,
    }),
    z.object({
      kind: z.literal('playlist_share'),
      comment: z.string().nullable(),
      card: PostShareCardSchema,
    }),
  ])
  .meta({ id: 'PostBody', description: 'The post ready to render, by kind' });

export const PostSchema = z
  .object({
    id: z.uuid(),
    channel: ChannelCardSchema.describe(
      "The channel that published it; a team member's post shows the channel, never the member"
    ),
    kind: z.enum(POST_KINDS),
    body: PostBodySchema,
    commentsEnabled: z.boolean(),
    likeCount: z.number().int().nonnegative(),
    commentsCount: z.number().int().nonnegative(),
    likedByViewer: z.boolean().describe('False for an anonymous reader'),
    pinned: z.boolean().describe('Shown above the rest of the channel posts'),
    isEdited: z.boolean(),
    publishedAt: z.string().describe('ISO 8601 timestamp'),
    version: z.number().int().positive().describe('The version an edit is made against'),
  })
  .meta({ id: 'Post', description: 'A published channel post' });

export const ManagedPostSchema = PostSchema.omit({ publishedAt: true })
  .extend({
    status: z.enum(['draft', 'scheduled', 'published']),
    publishAt: z.string().nullable().describe('When a scheduled post publishes'),
    publishedAt: z.string().nullable().describe('Null until the post is published'),
    createdAt: z.string(),
  })
  .meta({ id: 'ManagedPost', description: 'A post of the acting channel in any status' });

export const PostPageSchema = z.object({
  items: z.array(PostSchema),
  nextCursor: z.string().nullable(),
});

export const PostLikeSchema = z.object({
  postId: z.uuid(),
  liked: z.boolean(),
  likeCount: z.number().int().nonnegative(),
});

export const PostTimingSchema = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('now') }),
    z.object({ mode: z.literal('draft') }),
    z.object({
      mode: z.literal('schedule'),
      publishAt: z.iso.datetime().describe('When the post publishes, in the future'),
    }),
  ])
  .meta({ id: 'PostTiming', description: 'Publish now, keep as a draft or schedule' });

export const PostWriteBodySchema = z.object({
  payload: PostPayloadSchema,
  commentsEnabled: z.boolean().default(true).describe('Whether viewers may reply to the post'),
  timing: PostTimingSchema.default({ mode: 'now' }),
});

export type PostView = z.infer<typeof PostSchema>;
export type ManagedPostView = z.infer<typeof ManagedPostSchema>;
export type PostPageView = z.infer<typeof PostPageSchema>;
export type PostLikeView = z.infer<typeof PostLikeSchema>;
export type PostWriteBody = z.infer<typeof PostWriteBodySchema>;
export type PostWriteInput = z.input<typeof PostWriteBodySchema>;
