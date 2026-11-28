import { type DatabaseUnavailable } from '@kit/errors';
import { err, isErr, ok, type Result } from '@kit/result';
import {
  type CategoryRepositoryPort,
  type ChannelAuditRepositoryPort,
  type EntityRevisionRepository,
  type EventRepository,
  type OutboxRepository,
  type StudioMetadataOutcome,
  type TakeDownVideoOptions,
  type UpdateStudioMetadataOptions,
  type VideoLibraryQuery,
  type VideoRecord,
  type VideoRepository,
  VideoStudioRepository,
} from '@vp/core/repositories';
import {
  type CreatorLibraryCursor,
  creatorLibraryCursorOf,
  type VideoMetadataSnapshot,
  videoEditAudit,
  videoMetadataSnapshot,
} from '@vp/domain';
import { type VersionConflict, versionConflict } from '@vp/errors';
import { visibilityNotificationJobs } from '@vp/job-contracts';
import type { InMemoryVideoChapterRepository } from './in-memory-video-chapter-repository';

interface StudioVideos extends Pick<VideoRepository, 'transition'> {
  getAllVideos(): VideoRecord[];
}

export interface InMemoryVideoStudioRepositoryOptions {
  videos: StudioVideos;
  categories: Pick<CategoryRepositoryPort, 'findById'>;
  events: Pick<EventRepository, 'create'>;
  outbox: Pick<OutboxRepository, 'enqueue'>;
  audit: Pick<ChannelAuditRepositoryPort, 'append'>;
  revisions: Pick<EntityRevisionRepository, 'append' | 'list'>;
  chapters: Pick<InMemoryVideoChapterRepository, 'chaptersOf' | 'replace'>;
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
    const { channelId, sort, cursor, limit, status, visibility, categoryId, titleContains } = query;
    const direction = query.order === 'asc' ? 1 : -1;
    const keyOf = (video: VideoRecord) => creatorLibraryCursorOf(video, sort);
    const needle = titleContains?.toLowerCase();

    const rows = this.deps.videos
      .getAllVideos()
      .filter(
        (video) =>
          (!channelId || video.channelId === channelId) &&
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
    const { videoId, expectedVersion, userId, tokenId, auditFields, revision } = options;
    const { chapters, ...patch } = options.patch;
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
    const before = videoMetadataSnapshot(video, this.deps.chapters.chaptersOf(videoId));
    const baseline = { ...before };
    const baselineVersion = video.version;
    Object.assign(video, patch, { version: video.version + 1, updatedAt: new Date() });
    if (chapters !== undefined) this.deps.chapters.replace(videoId, chapters);
    const revised = await this.recordRevisions({
      video,
      baseline,
      baselineVersion,
      userId,
      restoredFromVersion: revision?.restoredFromVersion,
    });
    if (isErr(revised)) return revised;
    const recorded = await this.deps.events.create({
      videoId,
      type: 'video.metadata_updated',
      payload: { patch, expectedVersion, newVersion: video.version, requestedBy: userId },
    });
    if (isErr(recorded)) return recorded;

    const edit = {
      videoId,
      fields: auditFields,
      commentsEnabled: patch.commentsEnabled,
      restoredFromVersion: revision?.restoredFromVersion,
    };
    for (const entry of videoEditAudit(edit)) {
      const audited = await this.deps.audit.append({
        ...entry,
        channelId: video.channelId,
        actorUserId: userId,
        actorTokenId: tokenId,
      });
      if (isErr(audited)) return audited;
    }

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

  private async recordRevisions(edit: {
    video: VideoRecord;
    baseline: VideoMetadataSnapshot;
    baselineVersion: number;
    userId: string;
    restoredFromVersion?: number;
  }): Promise<Result<void, DatabaseUnavailable>> {
    const { video, baseline, baselineVersion, userId, restoredFromVersion } = edit;
    const { revisions, chapters } = this.deps;
    const known = await revisions.list('video_metadata', video.id, {
      beforeVersion: null,
      limit: 0,
    });
    if (isErr(known)) return known;
    if (known.value.length === 0) {
      const recorded = await revisions.append({
        entityType: 'video_metadata',
        entityId: video.id,
        version: baselineVersion,
        snapshot: baseline,
        authorUserId: null,
        restoredFromVersion: null,
      });
      if (isErr(recorded)) return recorded;
    }
    return revisions.append({
      entityType: 'video_metadata',
      entityId: video.id,
      version: video.version,
      snapshot: videoMetadataSnapshot(video, chapters.chaptersOf(video.id)),
      authorUserId: userId,
      restoredFromVersion: restoredFromVersion ?? null,
    });
  }

  async takeDown(
    options: TakeDownVideoOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable>> {
    const { videoId, moderatorId, reason } = options;
    const taken = await this.deps.videos.transition({
      videoId,
      edge: 'takedown',
      patch: { visibility: 'private' },
      eventPayload: { requestedBy: moderatorId, ...(reason ? { reason } : {}) },
    });
    if (isErr(taken)) return taken;

    const video = this.find(videoId);
    if (!(taken.value && video)) return ok(null);
    video.version += 1;
    return ok(video);
  }

  clear(): void {}
}
