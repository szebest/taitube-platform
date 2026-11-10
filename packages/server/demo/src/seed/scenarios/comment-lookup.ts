import { type Result, isErr, ok } from '@vp/result';
import type { z } from 'zod';
import type { Actor, Api } from '../api';
import type { SeedFailure } from '../failure';
import { PAGE_LIMIT, collectPages } from '../pages';
import { CommentPageSchema, type CommentSchema } from '../responses';

export type FoundComment = z.infer<typeof CommentSchema>;

export const sameComment = (comment: FoundComment, authorId: string, text: string) =>
  comment.content === text && comment.author?.userId === authorId;

export async function listRoots(
  api: Api,
  actor: Actor,
  videoId: string
): Promise<Result<FoundComment[], SeedFailure>> {
  return collectPages(
    api,
    (cursor) => ({
      actor,
      method: 'GET',
      path: `/v1/videos/${videoId}/comments`,
      query: { sort: 'newest', limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    }),
    CommentPageSchema
  );
}

export async function findRoot(
  api: Api,
  actor: Actor,
  videoId: string,
  authorId: string,
  text: string
): Promise<Result<FoundComment | null, SeedFailure>> {
  const roots = await listRoots(api, actor, videoId);
  if (isErr(roots)) return roots;
  return ok(roots.value.find((comment) => sameComment(comment, authorId, text)) ?? null);
}

export async function listReplies(
  api: Api,
  actor: Actor,
  commentId: string
): Promise<Result<FoundComment[], SeedFailure>> {
  return collectPages(
    api,
    (cursor) => ({
      actor,
      method: 'GET',
      path: `/v1/comments/${commentId}/replies`,
      query: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    }),
    CommentPageSchema
  );
}

export function hasReply(
  replies: readonly FoundComment[],
  authorId: string,
  text: string
): boolean {
  return replies.some((reply) => sameComment(reply, authorId, text));
}
