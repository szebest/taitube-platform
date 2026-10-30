import {
  type CategoryRepositoryPort,
  type EventRepository,
  type OutboxRepository,
  type StudioMetadataOutcome,
  type TakeDownVideoOptions,
  type UpdateStudioMetadataOptions,
  type VideoLibraryQuery,
  type VideoRecord,
  VideoStudioRepository,
} from '@vp/core/repositories';
import { type CreatorLibraryCursor, creatorLibraryCursorOf } from '@vp/domain';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import { visibilityNotificationJobs } from '@vp/job-contracts';
import { err, isErr, map, ok, type Result } from '@vp/result';

interface StudioVideos {
  getAllVideos(): VideoRecord[];
}

export interface InMemoryVideoStudioRepositoryOptions {
  videos: StudioVideos;
  categories: Pick<CategoryRepositoryPort, 'findById'>;
  events: Pick<EventRepository, 'create'>;
  outbox: Pick<OutboxRepository, 'enqueue'>;
}

function compare<T extends Date | number | string>(a: T, b: T): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function compareCursors(a: CreatorLibraryCursor, b: CreatorLibraryCursor): number {
  const delta = compare<Date | number | string>(a.value, b.value);
  return delta !== 0 ? delta : compare(a.id, b.id);
}

export class InMemoryVideoStudioRepository extends VideoStudioRepository {
  constructor(private readonly deps: InMemoryVideoStudioRepositoryOptions) {
    super();
  }

  private find(videoId: string): VideoRecord | undefined {
    return this.deps.videos.getAllVideos().find((video) => video.id === videoId);
  }

  async listLibrary(query: VideoLibraryQuery): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const { ownerId, sort, cursor, limit, status, visibility, categoryId, titleContains } = query;
    const direction = query.order === 'asc' ? 1 : -1;
    const keyOf = (video: VideoRecord) => creatorLibraryCursorOf(video, sort);
    const needle = titleContains?.toLowerCase();

    const rows = this.deps.videos
      .getAllVideos()
      .filter(
        (video) =>
          (!ownerId || video.ownerId === ownerId) &&
          video.status !== 'DELETED' &&
          !video.deletedAt &&
          (!status || video.status === status) &&
          (!visibility || video.visibility === visibility) &&
          (!categoryId || video.categoryId === categoryId) &&
          (!needle || (video.title ?? '').toLowerCase().includes(needle)) &&
          (!cursor || compareCursors(keyOf(video), cursor) * direction > 0)
      )
      .sort((a, b) => compareCursors(keyOf(a), keyOf(b)) * direction)
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

    const visibilityBefore = video.visibility;
    Object.assign(video, patch, { version: video.version + 1, updatedAt: new Date() });
    const recorded = await this.deps.events.create({
      videoId,
      type: 'video.metadata_updated',
      payload: { patch, expectedVersion, newVersion: video.version, requestedBy: userId },
    });
    if (isErr(recorded)) return recorded;

    for (const job of visibilityNotificationJobs(
      videoId,
      video.status,
      visibilityBefore,
      video.visibility
    )) {
      const enqueued = await this.deps.outbox.enqueue(job);
      if (isErr(enqueued)) return enqueued;
    }
    return ok({ type: 'updated', video });
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
