import {
  type CategoryRepositoryPort,
  type CreatorLibraryQuery,
  type EventRepository,
  type StudioMetadataOutcome,
  type TakeDownVideoOptions,
  type UpdateStudioMetadataOptions,
  type VideoRecord,
  VideoStudioRepository,
} from '@vp/core/repositories';
import { type CreatorLibraryCursor, creatorLibraryCursorOf } from '@vp/domain';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import { type Result, err, isErr, map, ok } from '@vp/result';

export interface StudioVideos {
  getAllVideos(): VideoRecord[];
}

export interface InMemoryVideoStudioRepositoryOptions {
  videos: StudioVideos;
  categories: Pick<CategoryRepositoryPort, 'findById'>;
  events: Pick<EventRepository, 'create'>;
}

function compareCursors(a: CreatorLibraryCursor, b: CreatorLibraryCursor): number {
  const delta = Number(a.value) - Number(b.value);
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

export class InMemoryVideoStudioRepository extends VideoStudioRepository {
  constructor(private readonly deps: InMemoryVideoStudioRepositoryOptions) {
    super();
  }

  private find(videoId: string): VideoRecord | undefined {
    return this.deps.videos.getAllVideos().find((video) => video.id === videoId);
  }

  async listLibrary(
    query: CreatorLibraryQuery
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { ownerId, sort, cursor, limit, status, visibility } = query;
    const keyOf = (video: VideoRecord) => creatorLibraryCursorOf(video, sort);

    const rows = this.deps.videos
      .getAllVideos()
      .filter(
        (video) =>
          video.ownerId === ownerId &&
          video.status !== 'DELETED' &&
          !video.deletedAt &&
          (!status || video.status === status) &&
          (!visibility || video.visibility === visibility) &&
          (!cursor || compareCursors(keyOf(video), cursor) < 0)
      )
      .sort((a, b) => compareCursors(keyOf(b), keyOf(a)))
      .slice(0, limit + 1);

    return ok(rows);
  }

  async updateMetadata(
    options: UpdateStudioMetadataOptions
  ): Promise<Result<StudioMetadataOutcome, DatabaseUnavailable | VersionConflict>> {
    const { videoId, expectedVersion, patch, userId } = options;
    const { categoryId } = patch;

    if (categoryId) {
      const category = await this.deps.categories.findById(categoryId);
      if (isErr(category)) return category;
      if (!category.value?.isActive) return ok({ type: 'category-missing', categoryId });
    }

    const video = this.find(videoId);
    if (!video) return ok({ type: 'video-missing' });
    if (video.version !== expectedVersion) return err(versionConflict(videoId, expectedVersion));

    Object.assign(video, patch, { version: video.version + 1, updatedAt: new Date() });
    const recorded = await this.deps.events.create({
      videoId,
      type: 'video.metadata_updated',
      payload: { patch, expectedVersion, newVersion: video.version, requestedBy: userId },
    });
    return map(recorded, (): StudioMetadataOutcome => ({ type: 'updated', video }));
  }

  async takeDown(
    options: TakeDownVideoOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    const { videoId, from, moderatorId, reason } = options;
    const video = this.find(videoId);
    if (!(video && from.includes(video.status))) return ok(null);

    Object.assign(video, {
      status: 'REJECTED',
      visibility: 'private',
      version: video.version + 1,
      updatedAt: new Date(),
    });
    const recorded = await this.deps.events.create({
      videoId,
      type: 'video.taken_down',
      payload: { requestedBy: moderatorId, ...(reason ? { reason } : {}) },
    });
    return map(recorded, () => video);
  }

  clear(): void {}
}
