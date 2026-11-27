import { type Result, andThen, err, ok } from '@kit/result';
import type { Video, VideoThread } from '@vp/domain';
import { type UserContext, canModerateComment } from '@vp/permissions';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import { type ThreadNotFound, threadNotFound } from './failures';

export interface ReadThreadInput {
  readonly viewer: UserContext | null;
  readonly thread: VideoThread | null;
  readonly threadId: string;
  readonly video: Video | null;
  /** The author is shadow banned on the channel: only they read the thread. */
  readonly authorShadowed?: boolean;
}

export type ReadThreadFailure = ReadVideoFailure | ThreadNotFound;

/** A held or hidden thread is for its author and for those who moderate its channel; a shadow banned author's is for them alone. */
function isThreadVisibleTo(
  viewer: UserContext | null,
  thread: VideoThread,
  video: Video,
  authorShadowed: boolean
): boolean {
  if (viewer?.id === thread.authorId) return true;
  if (authorShadowed) return false;
  if (thread.moderationState === 'published') return true;
  return canModerateComment({
    user: viewer,
    action: 'hold',
    videoOwnerId: video.ownerId,
    videoChannelId: video.channelId,
  });
}

/** The thread's video is read the way the video's own page is read, then the thread's own state. */
export function decideThreadRead(
  input: ReadThreadInput
): Result<{ thread: VideoThread; video: Video }, ReadThreadFailure> {
  const { viewer, thread, threadId } = input;
  if (!thread) return err(threadNotFound(threadId));
  return andThen(
    decideVideoRead({ viewer, video: input.video, videoId: thread.videoId }),
    (video) =>
      isThreadVisibleTo(viewer, thread, video, input.authorShadowed ?? false)
        ? ok({ thread, video })
        : err(threadNotFound(threadId))
  );
}
