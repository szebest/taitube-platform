import { assertNever, isErr, ok, type Result } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import { type CommentTarget, mayHearAbout, type Video } from '@vp/domain';
import { decidePostRead } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';

/** What a comment sits under, as telling people about it needs it. */
export interface CommentSubject {
  ownerId: string;
  videoId: string | null;
  videoTitle: string | null;
  /** The ids a notification of the comment carries beside `videoId`, to open the post or the thread. */
  link: { postId?: string; threadId?: string };
  mayHear: (userId: string) => boolean;
}

function videoSubject(video: Video, link: CommentSubject['link']): CommentSubject {
  return {
    ownerId: video.ownerId,
    videoId: video.id,
    videoTitle: video.title,
    link,
    mayHear: (userId) => mayHearAbout(video, userId),
  };
}

/** The subject of a target readers can see, or null once it is gone or out of public reads. */
export async function commentSubjectOf(
  repositories: Repositories,
  target: CommentTarget
): Promise<Result<CommentSubject | null, DatabaseUnavailable>> {
  switch (target.type) {
    case 'video': {
      const video = await repositories.videos.findById(target.id);
      if (isErr(video)) return video;
      const found = video.value;
      return ok(found && videoSubject(found, {}));
    }
    case 'post': {
      const post = await repositories.channelPosts.findById(target.id);
      if (isErr(post)) return post;
      if (isErr(decidePostRead({ post: post.value, postId: target.id }))) return ok(null);
      if (!post.value) return ok(null);
      const channel = await repositories.channels.findById(post.value.channelId);
      if (isErr(channel)) return channel;
      return ok(
        channel.value && {
          ownerId: channel.value.userId,
          videoId: null,
          videoTitle: null,
          link: { postId: target.id },
          mayHear: () => true,
        }
      );
    }
    case 'thread': {
      const entry = await repositories.videoThreads.findEntry(target.id);
      if (isErr(entry)) return entry;
      const { thread, authorShadowed } = entry.value ?? {};
      if (!thread || authorShadowed || thread.moderationState !== 'published') return ok(null);
      const video = await repositories.videos.findById(thread.videoId);
      if (isErr(video)) return video;
      const found = video.value;
      return ok(found && videoSubject(found, { threadId: thread.id }));
    }
    default:
      return assertNever(target, 'CommentTarget');
  }
}
