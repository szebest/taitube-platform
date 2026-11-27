import type { DatabaseUnavailable } from '@kit/errors';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, andThen, andThenAsync, err, isErr, ok } from '@kit/result';
import type {
  EntityRevisionRepository,
  VideoChapterRepository,
  VideoRepository,
} from '@vp/core/repositories';
import {
  ENTITY_REVISION_KEEP,
  type EntityRevision,
  type Video,
  type VideoMetadataSnapshot,
  videoMetadataSnapshot,
} from '@vp/domain';
import {
  type RevisionNotFound,
  type ReadVideoFailure,
  decideRevisionRestore,
  decideVideoEditAccess,
  revisionNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import type { CreatorStudioService } from './creator-studio-service';
import { isoOf } from './cursor';
import { decodeRevisionCursor, revisionCursorPayload } from './revision-cursor';
import type { UpdateVideoServiceFailure } from './video-edit';
import type { VideoDetailView } from './video-views';

export interface VideoRevisionServiceDeps {
  videos: VideoRepository;
  revisions: EntityRevisionRepository;
  chapters: VideoChapterRepository;
  studio: Pick<CreatorStudioService, 'update'>;
  paginator: Paginator;
}

export interface RevisionView {
  id: string;
  version: number;
  snapshot: VideoMetadataSnapshot;
  authorUserId: string | null;
  restoredFromVersion: number | null;
  createdAt: string;
}

export type ListRevisionsFailure = ReadVideoFailure | InvalidCursor | DatabaseUnavailable;
export type RestoreRevisionFailure =
  | RevisionNotFound
  | UpdateVideoServiceFailure
  | ListRevisionsFailure;

function toRevisionView(revision: EntityRevision<'video_metadata'>): RevisionView {
  const { id, version, snapshot, authorUserId, restoredFromVersion, createdAt } = revision;
  return {
    id,
    version,
    snapshot,
    authorUserId,
    restoredFromVersion,
    createdAt: isoOf(createdAt),
  };
}

export class VideoRevisionService {
  constructor(private readonly deps: VideoRevisionServiceDeps) {}

  async list(
    user: UserContext,
    videoId: string,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<{ items: RevisionView[]; nextCursor: string | null }, ListRevisionsFailure>> {
    const video = await this.editable(user, videoId);
    if (isErr(video)) return video;

    const limit = this.deps.paginator.limit(query.limit ?? ENTITY_REVISION_KEEP);
    const cursor = decodeRevisionCursor(query.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.revisions.list('video_metadata', videoId, {
      beforeVersion: cursor.value,
      limit,
    });
    return andThen(rows, (found) =>
      ok(
        this.deps.paginator.paginate(found, limit, {
          cursorOf: revisionCursorPayload,
          toItem: toRevisionView,
        })
      )
    );
  }

  /**
   * A normal edit under the caller's version, writing only the fields that differ from the current
   * state, so a stale restore is a 409 and a field rule such as a takedown's visibility lock still holds.
   */
  async restore(
    user: UserContext,
    videoId: string,
    revisionId: string,
    version: number
  ): Promise<Result<VideoDetailView, RestoreRevisionFailure>> {
    const video = await this.editable(user, videoId);
    if (isErr(video)) return video;

    const revision = await this.deps.revisions.get('video_metadata', videoId, revisionId);
    return andThenAsync(
      revision,
      async (target): Promise<Result<VideoDetailView, RestoreRevisionFailure>> => {
        if (!target) return err(revisionNotFound(videoId, revisionId));

        const chapters = await this.deps.chapters.listFor([videoId]);
        if (isErr(chapters)) return chapters;
        const current = videoMetadataSnapshot(video.value, chapters.value.get(videoId) ?? []);
        const patch = decideRevisionRestore(current, target.snapshot);

        return this.deps.studio.update(
          user,
          videoId,
          { ...patch, version },
          { restoredFromVersion: target.version }
        );
      }
    );
  }

  private async editable(
    user: UserContext,
    videoId: string
  ): Promise<Result<Video, ReadVideoFailure | DatabaseUnavailable>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    return decideVideoEditAccess({ editor: user, video: found.value, videoId });
  }
}
