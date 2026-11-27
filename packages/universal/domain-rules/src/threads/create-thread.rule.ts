import { type Result, andThen, err, map, ok } from '@kit/result';
import { THREADS_OPEN_PER_VIEWER, type Video } from '@vp/domain';
import { type UserContext, canCreateComment } from '@vp/permissions';
import { type InvalidThreadContent, validateThreadContent } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import {
  type ThreadAnchorInvalid,
  type ThreadLimit,
  threadAnchorInvalid,
  threadLimit,
} from './failures';

export interface CreateThreadInput {
  readonly author: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly title: string;
  readonly body: string;
  readonly anchorMs: number;
  /** The author's threads on this video that are still there, held ones too. */
  readonly openThreads: number;
}

export interface ThreadToCreate {
  readonly video: Video;
  readonly title: string;
  readonly body: string;
  readonly anchorMs: number;
}

export type CreateThreadFailure =
  | AuthorizationFailure
  | ReadVideoFailure
  | InvalidThreadContent
  | ThreadAnchorInvalid
  | ThreadLimit;

function withinVideo(video: Video, anchorMs: number): Result<number, ThreadAnchorInvalid> {
  const { durationMs } = video;
  return durationMs !== null && anchorMs >= 0 && anchorMs <= durationMs
    ? ok(anchorMs)
    : err(threadAnchorInvalid(anchorMs, durationMs));
}

function underLimit(openThreads: number): Result<number, ThreadLimit> {
  return openThreads < THREADS_OPEN_PER_VIEWER
    ? ok(openThreads)
    : err(threadLimit(THREADS_OPEN_PER_VIEWER));
}

/** Permission first, so an anonymous caller learns nothing about which videos exist. */
export function decideThreadCreate(
  input: CreateThreadInput
): Result<ThreadToCreate, CreateThreadFailure> {
  return andThen(
    authorize(input.author, canCreateComment({ user: input.author }), {
      action: 'create',
      subject: 'Comment',
    }),
    (author): Result<ThreadToCreate, CreateThreadFailure> =>
      andThen(
        decideVideoRead({ viewer: author, video: input.video, videoId: input.videoId }),
        (video) =>
          andThen(validateThreadContent(input), ({ title, body }) =>
            andThen(withinVideo(video, input.anchorMs), (anchorMs) =>
              map(underLimit(input.openThreads), () => ({ video, title, body, anchorMs }))
            )
          )
      )
  );
}
