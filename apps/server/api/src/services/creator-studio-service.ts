import type {
  ChannelRepositoryPort,
  StudioMetadataPatch,
  VideoLibraryQuery,
  VideoRecord,
  VideoRepository,
  VideoStudioRepository,
} from '@vp/core/repositories';
import type {
  CreatorLibrarySort,
  LibrarySort,
  SortOrder,
  ThumbnailSelection,
  VideoStatus,
  VideoVisibility,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type CategoryNotFound,
  DELETABLE_STATUSES,
  type UpdateVideoMetadataFailure,
  type VideoLifecycleFailure,
  type VideoMetadataPatch,
  categoryNotFound,
  decideAdminAccess,
  decideVideoMetadataUpdate,
  decideVideoTakedown,
  videoNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, assertNever, err, isErr, map } from '@vp/result';
import { creatorLibraryCursorPayload, decodeCreatorLibraryCursor } from './cursor';
import type { ReadVideoServiceFailure, VideoService } from './video-service';
import {
  type CreatorVideoView,
  type SpriteGeometry,
  type VideoDetailView,
  type VideoSummaryView,
  loadChannelsOf,
  toCreatorVideoView,
  toVideoSummaryView,
} from './video-views';

export interface CreatorStudioServiceDeps {
  videos: VideoRepository;
  studio: VideoStudioRepository;
  videoService: VideoService;
  channels: ChannelRepositoryPort;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  paginator: Paginator;
}

export interface CreatorLibraryOptions {
  sort: CreatorLibrarySort;
  cursor?: string;
  limit?: number;
  status?: VideoStatus;
  visibility?: VideoVisibility;
}

export interface AdminLibraryOptions {
  sort: LibrarySort;
  order: SortOrder;
  cursor?: string;
  limit?: number;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  categoryId?: string;
  q?: string;
}

export type AdminLibraryFailure = AuthorizationFailure | DatabaseUnavailable | InvalidCursor;

interface LibraryWalk {
  sort: LibrarySort;
  order: SortOrder;
  cursor?: string;
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

function thumbnailKeyOf(selection: ThumbnailSelection): string | null {
  switch (selection.source) {
    case 'poster':
      return null;
    default:
      return assertNever(selection.source, 'ThumbnailSelection');
  }
}

function toStudioPatch(patch: VideoMetadataPatch): StudioMetadataPatch {
  const { selectedThumbnail, ...columns } = patch;
  if (!selectedThumbnail) return columns;
  return { ...columns, customThumbnailKey: thumbnailKeyOf(selectedThumbnail) };
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
    const walked = await this.walk({ sort, order: 'desc', cursor: options.cursor }, options.limit, {
      ownerId: user.id,
      status,
      visibility,
    });
    if (isErr(walked)) return walked;
    const { rows, limit } = walked.value;

    const channelOf = await loadChannelsOf(this.deps.channels, [user.id]);
    return map(channelOf, (of) =>
      this.deps.paginator.paginate(rows, limit, {
        cursorOf: (row) => creatorLibraryCursorPayload(row, sort),
        toItem: (row) => toCreatorVideoView(row, this.deps.cdn, this.deps.sprite, of(user.id)),
      })
    );
  }

  async libraryOfAll(
    actor: UserContext | null,
    options: AdminLibraryOptions
  ): Promise<
    Result<{ items: VideoSummaryView[]; nextCursor: string | null }, AdminLibraryFailure>
  > {
    const admin = decideAdminAccess(actor);
    if (isErr(admin)) return admin;

    const { sort, order, status, visibility, categoryId, q } = options;
    const walked = await this.walk({ sort, order, cursor: options.cursor }, options.limit, {
      status,
      visibility,
      categoryId,
      titleContains: q,
    });
    if (isErr(walked)) return walked;
    const { rows, limit } = walked.value;

    const owners = [...new Set(rows.slice(0, limit).map((row) => row.ownerId))];
    const channelOf = await loadChannelsOf(this.deps.channels, owners);
    return map(channelOf, (of) =>
      this.deps.paginator.paginate(rows, limit, {
        cursorOf: (row) => creatorLibraryCursorPayload(row, sort, order),
        toItem: (row) => toVideoSummaryView(row, this.deps.cdn, this.deps.sprite, of(row.ownerId)),
      })
    );
  }

  private async walk(
    { sort, order, cursor: encoded }: LibraryWalk,
    requestedLimit: number | undefined,
    filters: Pick<
      VideoLibraryQuery,
      'ownerId' | 'status' | 'visibility' | 'categoryId' | 'titleContains'
    >
  ): Promise<Result<{ rows: VideoRecord[]; limit: number }, DatabaseUnavailable | InvalidCursor>> {
    const limit = this.deps.paginator.limit(requestedLimit);
    const cursor = decodeCreatorLibraryCursor(encoded, sort, this.deps.paginator, order);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.studio.listLibrary({
      ...filters,
      sort,
      order,
      cursor: cursor.value,
      limit,
    });
    return map(rows, (found) => ({ rows: found, limit }));
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
      patch: toStudioPatch(decided.value),
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
