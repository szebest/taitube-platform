import type { AuthoredCommentView } from '@vp/api-contracts';
import type { CommentRepositoryPort, VideoReactionRepositoryPort } from '@vp/core/repositories';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { andThenAsync, isErr, map, ok, type Result } from '@vp/result';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import { type SpriteGeometry, toVideoSummaryView, type VideoSummaryView } from './video-views';
import type { ViewerProgress } from './viewer-progress';

export interface ViewerActivityServiceDeps {
  reactions: VideoReactionRepositoryPort;
  comments: CommentRepositoryPort;
  viewerProgress: ViewerProgress;
  paginator: Paginator;
  cdn: CdnBase;
  sprite: SpriteGeometry;
}

interface ActivityQuery {
  cursor?: string;
  limit?: number;
}

type ActivityFailure = DatabaseUnavailable | InvalidCursor;

/** What the caller liked and wrote: private lists, each read keyed by their own id. */
export class ViewerActivityService {
  constructor(private readonly deps: ViewerActivityServiceDeps) {}

  async likedVideos(
    viewer: UserContext,
    query: ActivityQuery
  ): Promise<Result<{ items: VideoSummaryView[]; nextCursor: string | null }, ActivityFailure>> {
    const { paginator, cdn, sprite } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.reactions.listLiked(viewer, {
      cursor: cursor.value && { likedAt: cursor.value.createdAt, id: cursor.value.id },
      limit,
    });
    return andThenAsync(rows, async (entries) => {
      const page = paginator.paginate(entries, limit, {
        cursorOf: ({ likedAt, id }) => createdAtCursorPayload({ createdAt: likedAt, id }),
        toItem: ({ video, channel }) => toVideoSummaryView(video, cdn, sprite, channel),
      });
      return ok({ ...page, items: await this.deps.viewerProgress.attach(viewer, page.items) });
    });
  }

  async comments(
    viewer: UserContext,
    query: ActivityQuery
  ): Promise<Result<{ items: AuthoredCommentView[]; nextCursor: string | null }, ActivityFailure>> {
    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.comments.listByAuthor(viewer, {
      cursor: cursor.value,
      limit,
    });
    return map(rows, (comments) =>
      paginator.paginate(comments, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: ({ createdAt, ...comment }): AuthoredCommentView => ({
          ...comment,
          createdAt: createdAt.toISOString(),
        }),
      })
    );
  }
}
