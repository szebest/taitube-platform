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

export type PostAlreadyVoted = Failure<typeof ErrorCodes.POST_ALREADY_VOTED, { postId: string }>;
export type PostPollClosed = Failure<typeof ErrorCodes.POST_POLL_CLOSED, { postId: string }>;
export type PostPollLocked = Failure<typeof ErrorCodes.POST_POLL_LOCKED, { postId: string }>;
export type PostPinLimit = Failure<typeof ErrorCodes.POST_PIN_LIMIT, { limit: number }>;
export type PostDraftLimit = Failure<typeof ErrorCodes.POST_DRAFT_LIMIT, { limit: number }>;
export type PostScheduleReason = 'in_past' | 'already_published';
export type PostScheduleInvalid = Failure<
  typeof ErrorCodes.POST_SCHEDULE_INVALID,
  { reason: PostScheduleReason }
>;
export type PostImageNotReady = Failure<
  typeof ErrorCodes.POST_IMAGE_NOT_READY,
  { uploadId: string }
>;

export function postAlreadyVoted(postId: string): PostAlreadyVoted {
  return { code: ErrorCodes.POST_ALREADY_VOTED, message: 'You already voted on this post', postId };
}

export function postPollClosed(postId: string): PostPollClosed {
  return { code: ErrorCodes.POST_POLL_CLOSED, message: 'This poll has closed', postId };
}

export function postPollLocked(postId: string): PostPollLocked {
  return {
    code: ErrorCodes.POST_POLL_LOCKED,
    message: 'A poll cannot change after its first vote',
    postId,
  };
}

export function postPinLimit(limit: number): PostPinLimit {
  return {
    code: ErrorCodes.POST_PIN_LIMIT,
    message: 'The channel pinned as many posts as it can',
    limit,
  };
}

export function postDraftLimit(limit: number): PostDraftLimit {
  return {
    code: ErrorCodes.POST_DRAFT_LIMIT,
    message: 'The channel holds as many drafts and scheduled posts as it can',
    limit,
  };
}

export function postScheduleInvalid(reason: PostScheduleReason): PostScheduleInvalid {
  return {
    code: ErrorCodes.POST_SCHEDULE_INVALID,
    message: 'The post cannot be scheduled that way',
    reason,
  };
}

export function postImageNotReady(uploadId: string): PostImageNotReady {
  return {
    code: ErrorCodes.POST_IMAGE_NOT_READY,
    message: 'An image is not ready or belongs to another channel',
    uploadId,
  };
}

export type PostRevisionNotFound = Failure<
  typeof ErrorCodes.REVISION_NOT_FOUND,
  { postId: string; revisionId: string }
>;

export function postRevisionNotFound(postId: string, revisionId: string): PostRevisionNotFound {
  return { code: ErrorCodes.REVISION_NOT_FOUND, message: 'Revision not found', postId, revisionId };
}
