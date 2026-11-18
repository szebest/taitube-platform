import { type Result, err, isErr, ok } from '@kit/result';
import type { Chapter, ThumbnailSelection, Video, VideoVisibility } from '@vp/domain';
import { type UserContext, canUpdateVideo } from '@vp/permissions';
import { type VideoMetadataFailure, validateVideoMetadata } from '@vp/validation';
import { type InvalidChapters, decideChapters } from '../chapters/index';
import { type ReadVideoFailure, videoEditForbidden } from './failures';
import { decideVideoRead } from './read-video.rule';

export interface VideoMetadataPatch {
  readonly title?: string;
  readonly description?: string;
  readonly visibility?: VideoVisibility;
  readonly categoryId?: string | null;
  readonly tags?: string[];
  readonly selectedThumbnail?: ThumbnailSelection;
  readonly commentsEnabled?: boolean;
  readonly chapters?: Chapter[];
}

export interface UpdateVideoMetadataInput {
  readonly editor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly patch: VideoMetadataPatch;
}

export type UpdateVideoMetadataFailure = ReadVideoFailure | VideoMetadataFailure | InvalidChapters;

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
    video: input.video?.status === 'DELETED' ? null : input.video,
    videoId: input.videoId,
  });
  if (isErr(readable)) return readable;

  const fields = Object.keys(input.patch);
  if (!canUpdateVideo({ user: input.editor, video: readable.value, fields })) {
    return err(videoEditForbidden(input.videoId));
  }

  const metadata = validateVideoMetadata(input.patch);
  if (isErr(metadata) || metadata.value.chapters === undefined) return metadata;

  const chapters = decideChapters(metadata.value.chapters, readable.value);
  return isErr(chapters) ? chapters : ok({ ...metadata.value, chapters: chapters.value });
}
