import type { Video, VideoVisibility } from '@vp/domain';
import { type UserContext, canUpdateVideo } from '@vp/permissions';
import { type Result, err, isErr, map } from '@vp/result';
import { type VideoMetadataFailure, validateVideoMetadata } from '@vp/validation';
import { type ReadVideoFailure, videoEditForbidden } from './failures';
import { decideVideoRead } from './read-video.rule';

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

/**
 * Composes the read rather than restating it, so an editor who cannot even see the video gets the
 * read's verdict - which the public edge disguises - and one who can see it but may not edit gets a
 * refusal that hides nothing.
 */
export function decideVideoMetadataUpdate(
  input: UpdateVideoMetadataInput
): Result<VideoMetadataPatch, UpdateVideoMetadataFailure> {
  const readable = decideVideoRead({
    viewer: input.editor,
    video: input.video,
    videoId: input.videoId,
  });
  if (isErr(readable)) return readable;

  const fields = Object.keys(input.patch);
  if (!canUpdateVideo({ user: input.editor, video: readable.value, fields })) {
    return err(videoEditForbidden(input.videoId));
  }

  return map(validateVideoMetadata(input.patch), () => input.patch);
}
