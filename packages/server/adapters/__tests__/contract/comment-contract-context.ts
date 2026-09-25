import type { CommentRepositoryPort, CommentWindow } from '@vp/core/repositories';
import type { CommentThread } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { HOUR_MS, OTHER_OWNER_ID, VIDEO_IDS } from './fixtures';
import type { RepositoriesSubject } from './subjects';

export interface CommentContractContext {
  readonly subject: RepositoriesSubject;
  readonly comments: CommentRepositoryPort;
}

export const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';

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
  options: { parentId?: string; hoursAgo?: number; likes?: number; videoId?: string } = {}
): Promise<void> {
  expectOk(
    await ctx.comments.create({
      id,
      videoId: options.videoId ?? VIDEO_IDS.a,
      authorId: OTHER_OWNER_ID,
      parentId: options.parentId ?? null,
      content: `comment ${id.slice(-2)}`,
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
