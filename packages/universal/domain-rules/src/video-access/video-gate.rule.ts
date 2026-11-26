import { type Result, err, ok } from '@kit/result';
import type { Video } from '@vp/domain';
import { type ShareGrant, type UserContext, canUpdateVideo } from '@vp/permissions';
import { type VideoPasswordRequired, videoPasswordRequired } from './failures';

export interface VideoGateInput {
  readonly viewer: UserContext | null;
  readonly video: Video;
  /** The caller presented a valid unlock credential for this video. */
  readonly unlocked: boolean;
  readonly share: ShareGrant | null;
}

/**
 * The password gate, after the read allowed the video. It guards an unlisted video only, so a
 * video made public later is public; whoever may edit it, a live share link and the unlock
 * credential each pass it. A page and API gate, not encryption.
 */
export function decideVideoGate(input: VideoGateInput): Result<Video, VideoPasswordRequired> {
  const { video, viewer } = input;
  const guarded = video.passwordProtected === true && video.visibility === 'unlisted';
  const passes =
    !guarded || input.unlocked || input.share !== null || canUpdateVideo({ user: viewer, video });
  return passes ? ok(video) : err(videoPasswordRequired(video.id));
}
