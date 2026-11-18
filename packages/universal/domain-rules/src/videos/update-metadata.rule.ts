import { type Result, isErr, ok } from '@kit/result';
import type { Chapter, ThumbnailSelection, Video, VideoVisibility } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type VideoMetadataFailure, validateVideoMetadata } from '@vp/validation';
import { type InvalidChapters, decideChapters } from '../chapters/index';
import { decideVideoEditAccess } from './edit-access.rule';
import type { ReadVideoFailure } from './failures';

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
  const readable = decideVideoEditAccess({
    editor: input.editor,
    video: input.video,
    videoId: input.videoId,
    fields: Object.keys(input.patch),
  });
  if (isErr(readable)) return readable;

  const metadata = validateVideoMetadata(input.patch);
  if (isErr(metadata) || metadata.value.chapters === undefined) return metadata;

  const chapters = decideChapters(metadata.value.chapters, readable.value);
  return isErr(chapters) ? chapters : ok({ ...metadata.value, chapters: chapters.value });
}
