import type { Failure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';

export type PostNotFound = Failure<typeof ErrorCodes.POST_NOT_FOUND, { postId: string }>;

export type PostShareNotPublic = Failure<
  typeof ErrorCodes.POST_SHARE_NOT_PUBLIC,
  { shared: 'video' | 'playlist'; id: string }
>;

export type PostDailyLimit = Failure<typeof ErrorCodes.POST_DAILY_LIMIT, { limit: number }>;

export function postNotFound(postId: string): PostNotFound {
  return { code: ErrorCodes.POST_NOT_FOUND, message: 'Post not found', postId };
}

export function postShareNotPublic(shared: 'video' | 'playlist', id: string): PostShareNotPublic {
  return {
    code: ErrorCodes.POST_SHARE_NOT_PUBLIC,
    message: 'Only a public video or playlist can be shared',
    shared,
    id,
  };
}

export function postDailyLimit(limit: number): PostDailyLimit {
  return {
    code: ErrorCodes.POST_DAILY_LIMIT,
    message: 'The channel published its posts for today',
    limit,
  };
}
