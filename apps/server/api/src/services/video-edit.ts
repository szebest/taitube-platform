import { type Result, assertNever, err, ignore, isErr } from '@kit/result';
import type {
  StudioMetadataPatch,
  VideoRepository,
  VideoStudioRepository,
} from '@vp/core/repositories';
import type { ThumbnailSelection, VideoAuditField, VideoVisibility } from '@vp/domain';
import {
  type CategoryNotFound,
  type UpdateVideoMetadataFailure,
  type VideoMetadataPatch,
  categoryNotFound,
  decideVideoMetadataUpdate,
  videoNotFound,
} from '@vp/domain-rules';
import { type VersionConflict, versionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { MetadataScreening } from './metadata-screening';
import type { ReadVideoServiceFailure, VideoService } from './video-service';
import type { VideoDetailView } from './video-views';

export interface VideoEditDeps {
  videos: VideoRepository;
  studio: VideoStudioRepository;
  videoService: VideoService;
  metadataScreening: MetadataScreening;
}

export interface CreatorVideoEdit {
  title?: string;
  description?: string;
  visibility?: VideoVisibility;
  categoryId?: string | null;
  tags?: string[];
  selectedThumbnail?: ThumbnailSelection;
  commentsEnabled?: boolean;
  chapters?: { startMs: number; title: string }[];
  version: number;
}

export interface VideoEditOptions {
  note?: string;
  restoredFromVersion?: number;
}

export type UpdateVideoServiceFailure =
  | UpdateVideoMetadataFailure
  | CategoryNotFound
  | ReadVideoServiceFailure
  | VersionConflict;

function thumbnailKeyOf(selection: ThumbnailSelection): string | null {
  switch (selection.source) {
    case 'poster':
      return null;
    default:
      return assertNever(selection.source, 'ThumbnailSelection');
  }
}

type AuditedField = Exclude<keyof VideoMetadataPatch, 'commentsEnabled'>;

const AUDIT_FIELD_OF: Record<AuditedField, VideoAuditField> = {
  title: 'title',
  description: 'description',
  visibility: 'visibility',
  categoryId: 'categoryId',
  tags: 'tags',
  selectedThumbnail: 'thumbnail',
  chapters: 'chapters',
};

function auditFieldsOf(patch: VideoMetadataPatch): VideoAuditField[] {
  return (Object.keys(AUDIT_FIELD_OF) as AuditedField[])
    .filter((field) => patch[field] !== undefined)
    .map((field) => AUDIT_FIELD_OF[field]);
}

/** Only the words a screening reads: a visibility or category change raises nothing. */
function editsText({ title, description, tags }: VideoMetadataPatch): boolean {
  return [title, description, tags].some((field) => field !== undefined);
}

function toStudioPatch(patch: VideoMetadataPatch): StudioMetadataPatch {
  const { selectedThumbnail, ...columns } = patch;
  if (!selectedThumbnail) return columns;
  return { ...columns, customThumbnailKey: thumbnailKeyOf(selectedThumbnail) };
}

/**
 * The one way a video's metadata changes: a single edit, a bulk edit, a restore and a chapter
 * replacement all land here. The rule is decided against the row as read, so the write must land on
 * that same row: the caller's version has to be the one read, and the repository's CAS on it rejects
 * anything since.
 */
export async function applyVideoEdit(
  deps: VideoEditDeps,
  user: UserContext,
  videoId: string,
  edit: CreatorVideoEdit,
  options: VideoEditOptions = {}
): Promise<Result<VideoDetailView, UpdateVideoServiceFailure>> {
  const found = await deps.videos.findById(videoId);
  if (isErr(found)) return found;

  const { version, ...patch } = edit;
  const decided = decideVideoMetadataUpdate({ editor: user, video: found.value, videoId, patch });
  if (isErr(decided)) return decided;
  if (found.value?.version !== version) return err(versionConflict(videoId, version));

  const outcome = await deps.studio.updateMetadata({
    videoId,
    expectedVersion: version,
    patch: toStudioPatch(decided.value),
    userId: user.id,
    tokenId: user.token?.id,
    auditFields: auditFieldsOf(decided.value),
    revision: options,
  });
  if (isErr(outcome)) return outcome;

  switch (outcome.value.type) {
    case 'updated':
      if (editsText(decided.value)) {
        ignore(
          await deps.metadataScreening.flag(outcome.value.video),
          'the edit is saved, and the next edit of the text raises the flag again'
        );
      }
      return deps.videoService.get(user, videoId);
    case 'video-missing':
      return err(videoNotFound(videoId));
    case 'category-missing':
      return err(categoryNotFound(outcome.value.categoryId));
    default:
      return assertNever(outcome.value, 'StudioMetadataOutcome');
  }
}
