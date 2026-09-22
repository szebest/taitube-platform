import type { Video, VideoVisibility } from '@vp/domain';
import { type UserContext, canUpdateVideo } from '@vp/permissions';
import { type Result, err, map } from '@vp/result';
import { type VideoMetadataFailure, validateVideoMetadata } from '@vp/validation';
import { type ReadVideoFailure, videoForbidden, videoNotFound } from './failures.js';

export interface VideoMetadataPatch {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly visibility?: VideoVisibility;
}

export interface UpdateVideoMetadataInput {
  readonly editor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly patch: VideoMetadataPatch;
}

export type UpdateVideoMetadataFailure = ReadVideoFailure | VideoMetadataFailure;

export function decideVideoMetadataUpdate(
  input: UpdateVideoMetadataInput
): Result<VideoMetadataPatch, UpdateVideoMetadataFailure> {
  if (!input.video) return err(videoNotFound(input.videoId));

  const fields = Object.keys(input.patch);
  if (!canUpdateVideo({ user: input.editor, video: input.video, fields })) {
    return err(videoForbidden(input.videoId));
  }

  return map(validateVideoMetadata(input.patch), () => input.patch);
}
