import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr } from '@kit/result';
import type { VideoRepository } from '@vp/core/repositories';
import type { Video } from '@vp/domain';
import { type ReadVideoFailure, decideVideoEditAccess, publicReadFailure } from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';

export type EditAccessFailure = ReadVideoFailure | DatabaseUnavailable;

/** The video `editor` may change; one they cannot even read answers as absent. */
export async function editableVideo(
  videos: VideoRepository,
  editor: UserContext,
  videoId: string
): Promise<Result<Video, EditAccessFailure>> {
  const found = await videos.findById(videoId);
  if (isErr(found)) return found;
  const video = decideVideoEditAccess({ editor, video: found.value, videoId });
  return isErr(video) ? err(publicReadFailure(video.error)) : video;
}
