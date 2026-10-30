import type { Video } from '@vp/domain';
import {
  type CaptionResource,
  canManageCaptions,
  canReadCaptions,
  type UserContext,
} from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import {
  decideVideoRead,
  type ReadVideoFailure,
  videoEditForbidden,
  videoForbidden,
} from '../videos/index';

export interface CaptionsAccessInput {
  readonly viewer: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

export interface CaptionsAccess {
  readonly video: Video;
  /** The caller may see every track and change them, not only read what is published. */
  readonly manager: boolean;
}

function captionsOf(video: Video): CaptionResource {
  return { videoId: video.id, ownerId: video.ownerId, visibility: video.visibility };
}

/**
 * Captions are read wherever the video is, so a refusal is the video read's own: `publicReadFailure`
 * turns it into `VIDEO_NOT_FOUND` for someone who cannot see the video.
 */
export function decideCaptionsRead(
  input: CaptionsAccessInput
): Result<CaptionsAccess, ReadVideoFailure> {
  const video = input.video?.status === 'DELETED' ? null : input.video;
  return andThen(
    decideVideoRead({ viewer: input.viewer, video, videoId: input.videoId }),
    (readable) => {
      const caption = captionsOf(readable);
      if (!canReadCaptions({ user: input.viewer, caption }))
        return err(videoForbidden(input.videoId));
      return ok({ video: readable, manager: canManageCaptions({ user: input.viewer, caption }) });
    }
  );
}

/** A caller who can see the video but may not change its captions gets a 403 that hides nothing. */
export function decideCaptionsManage(input: CaptionsAccessInput): Result<Video, ReadVideoFailure> {
  return andThen(decideCaptionsRead(input), ({ video, manager }) =>
    manager ? ok(video) : err(videoEditForbidden(input.videoId))
  );
}
