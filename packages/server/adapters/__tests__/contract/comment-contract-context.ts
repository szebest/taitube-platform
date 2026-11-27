import { expectOk } from '@kit/testing/result';
import type { CommentRepositoryPort, CommentWindow } from '@vp/core/repositories';
import type { CommentThread, CreatorInboxFilter, NewCommentModeration } from '@vp/domain';
import {
  HOUR_MS,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  primaryChannelOf,
  videoTarget,
} from './fixtures';
import type { RepositoriesSubject } from './subjects';

export interface CommentContractContext {
  readonly subject: RepositoriesSubject;
  readonly comments: CommentRepositoryPort;
  /** Who writes the seeded comments. */
  readonly authorId: string;
}

export const C = {
  old: '00000000-0000-7000-8000-000000000c01',
  liked: '00000000-0000-7000-8000-000000000c02',
  fresh: '00000000-0000-7000-8000-000000000c03',
  reply1: '00000000-0000-7000-8000-000000000c04',
  reply2: '00000000-0000-7000-8000-000000000c05',
  other: '00000000-0000-7000-8000-000000000c06',
} as const;

const BASE = Date.parse('2026-03-01T12:00:00.000Z');

export function keyset(limit: number): CommentWindow {
  return { type: 'keyset', cursor: null, limit };
}

export function nextWindow(row: CommentThread, limit: number): CommentWindow {
  const { isPinned, likeCount, createdAt, id } = row;
  return { type: 'keyset', cursor: { isPinned, likeCount, createdAt, id }, limit };
}

export async function commentsCount(
  ctx: CommentContractContext,
  videoId: string
): Promise<number | undefined> {
  return expectOk(await ctx.subject.repositories.videos.findById(videoId))?.commentsCount;
}

export async function seedComment(
  ctx: CommentContractContext,
  id: string,
  options: {
    parentId?: string;
    hoursAgo?: number;
    likes?: number;
    videoId?: string;
    moderation?: NewCommentModeration;
  } = {}
): Promise<void> {
  const videoId = options.videoId ?? VIDEO_IDS.a;
  const channelId = expectOk(await ctx.subject.repositories.videos.findById(videoId))?.channelId;
  if (!channelId) throw new Error(`seedComment found no video ${videoId}`);
  expectOk(
    await ctx.comments.create({
      id,
      target: videoTarget(videoId),
      channelId,
      authorId: ctx.authorId,
      authorChannelId: primaryChannelOf(ctx.authorId),
      parentId: options.parentId ?? null,
      content: `comment ${id.slice(-2)}`,
      moderation: options.moderation,
    })
  );
  await ctx.subject.adjustComment(id, {
    createdAt: new Date(BASE - (options.hoursAgo ?? 0) * HOUR_MS),
    likeCount: options.likes ?? 0,
  });
}

export async function seedThreads(ctx: CommentContractContext): Promise<void> {
  await seedComment(ctx, C.old, { hoursAgo: 3, likes: 1 });
  await seedComment(ctx, C.liked, { hoursAgo: 2, likes: 9 });
  await seedComment(ctx, C.fresh, { hoursAgo: 1 });
  await seedComment(ctx, C.reply1, { parentId: C.liked, hoursAgo: 0.5 });
  await seedComment(ctx, C.reply2, { parentId: C.liked, hoursAgo: 0.25 });
}

export async function creatorInbox(
  ctx: CommentContractContext,
  filter: CreatorInboxFilter = 'all',
  limit = 10
) {
  return expectOk(
    await ctx.comments.listForOwner(OWNER_ID, {
      channelId: OWNER_CHANNEL_ID,
      filter,
      cursor: null,
      limit,
    })
  );
}
