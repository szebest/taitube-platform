import type { VideoRepository } from '@vp/core/repositories';
import type { Video } from '@vp/domain';
import {
  type CaptionsAccess,
  decideCaptionsManage,
  decideCaptionsRead,
  type ReadVideoFailure,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { andThen, type Result } from '@vp/result';

export type CaptionAccessFailure = ReadVideoFailure | DatabaseUnavailable;

export async function readCaptions(
  videos: VideoRepository,
  viewer: UserContext | null,
  videoId: string
): Promise<Result<CaptionsAccess, CaptionAccessFailure>> {
  return andThen(await videos.findById(videoId), (video) =>
    decideCaptionsRead({ viewer, video, videoId })
  );
}

export async function manageCaptions(
  videos: VideoRepository,
  actor: UserContext,
  videoId: string
): Promise<Result<Video, CaptionAccessFailure>> {
  return andThen(await videos.findById(videoId), (video) =>
    decideCaptionsManage({ viewer: actor, video, videoId })
  );
}
