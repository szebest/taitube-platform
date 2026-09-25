import type {
  StudioMetadataPatch,
  VideoRepository,
  VideoStudioRepository,
} from '@vp/core/repositories';
import type {
  CreatorLibrarySort,
  ThumbnailSelection,
  VideoStatus,
  VideoVisibility,
} from '@vp/domain';
import {
  type CategoryNotFound,
  DELETABLE_STATUSES,
  type UpdateVideoMetadataFailure,
  type VideoLifecycleFailure,
  type VideoMetadataPatch,
  categoryNotFound,
  decideVideoMetadataUpdate,
  decideVideoTakedown,
  videoNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, assertNever, err, isErr, map } from '@vp/result';
import { customThumbnailKey } from '@vp/storage';
import { creatorLibraryCursorPayload, decodeCreatorLibraryCursor } from './cursor';
import type { ReadVideoServiceFailure, VideoService } from './video-service';
import { type CreatorVideoView, type VideoDetailView, toCreatorVideoView } from './video-views';

export interface CreatorStudioServiceDeps {
  videos: VideoRepository;
  studio: VideoStudioRepository;
  videoService: VideoService;
  cdn: CdnBase;
  paginator: Paginator;
}

export interface CreatorLibraryOptions {
  sort: CreatorLibrarySort;
  cursor?: string;
  limit?: number;
  status?: VideoStatus;
  visibility?: VideoVisibility;
}

export interface CreatorVideoEdit {
  title?: string;
  description?: string;
  visibility?: VideoVisibility;
  categoryId?: string | null;
  tags?: string[];
  selectedThumbnail?: ThumbnailSelection;
  version: number;
}

export type UpdateVideoServiceFailure =
  | UpdateVideoMetadataFailure
  | CategoryNotFound
  | ReadVideoServiceFailure
  | VersionConflict;

export type TakeDownServiceFailure =
  | VideoLifecycleFailure
  | ReadVideoServiceFailure
  | VersionConflict;

function thumbnailKeyOf(videoId: string, selection: ThumbnailSelection): string | null {
  switch (selection.source) {
    case 'poster':
      return null;
    case 'custom':
      return customThumbnailKey(videoId, selection.thumbnailId, selection.format);
    default:
      return assertNever(selection, 'ThumbnailSelection');
  }
}

function toStudioPatch(videoId: string, patch: VideoMetadataPatch): StudioMetadataPatch {
  const { selectedThumbnail, ...columns } = patch;
  if (!selectedThumbnail) return columns;
  return { ...columns, customThumbnailKey: thumbnailKeyOf(videoId, selectedThumbnail) };
}

export class CreatorStudioService {
  constructor(private readonly deps: CreatorStudioServiceDeps) {}

  async library(
    user: UserContext,
    options: CreatorLibraryOptions
  ): Promise<
    Result<
      { items: CreatorVideoView[]; nextCursor: string | null },
      DatabaseUnavailable | InvalidCursor
    >
  > {
    const { sort, status, visibility } = options;
    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeCreatorLibraryCursor(options.cursor, sort, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.studio.listLibrary({
      ownerId: user.id,
      sort,
      cursor: cursor.value,
      limit,
      status,
      visibility,
    });

    return map(rows, (found) =>
      this.deps.paginator.paginate(found, limit, {
        cursorOf: (row) => creatorLibraryCursorPayload(row, sort),
        toItem: (row) => toCreatorVideoView(row, this.deps.cdn),
      })
    );
  }

  /**
   * The rule is decided against the row as read, so the write must land on that same row: the
   * caller's version has to be the one read, and the repository's CAS on it rejects anything since.
   */
  async update(
    user: UserContext,
    videoId: string,
    edit: CreatorVideoEdit
  ): Promise<Result<VideoDetailView, UpdateVideoServiceFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const { version, ...patch } = edit;
    const decided = decideVideoMetadataUpdate({ editor: user, video: found.value, videoId, patch });
    if (isErr(decided)) return decided;
    if (found.value?.version !== version) return err(versionConflict(videoId, version));

    const outcome = await this.deps.studio.updateMetadata({
      videoId,
      expectedVersion: version,
      patch: toStudioPatch(videoId, decided.value),
      userId: user.id,
    });
    if (isErr(outcome)) return outcome;

    switch (outcome.value.type) {
      case 'updated':
        return this.deps.videoService.get(user, videoId);
      case 'video-missing':
        return err(videoNotFound(videoId));
      case 'category-missing':
        return err(categoryNotFound(outcome.value.categoryId));
      default:
        return assertNever(outcome.value, 'StudioMetadataOutcome');
    }
  }

  async takeDown(
    moderator: UserContext,
    videoId: string,
    reason?: string
  ): Promise<Result<VideoDetailView, TakeDownServiceFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideVideoTakedown({ actor: moderator, video: found.value, videoId });
    if (isErr(decided)) return decided;

    const taken = await this.deps.studio.takeDown({
      videoId,
      from: DELETABLE_STATUSES,
      moderatorId: moderator.id,
      reason,
    });
    if (isErr(taken)) return taken;
    if (!taken.value) return err(versionConflict(videoId));

    return this.deps.videoService.get(moderator, videoId);
  }
}
