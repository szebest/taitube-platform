import type { CommentRemovalView } from '@vp/api-contracts';
import type { CommentModerationRepositoryPort } from '@vp/core/repositories';
import { COMMENT_REMOVAL_RETENTION_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, map } from '@vp/result';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface CommentRemovalServiceDeps {
  moderation: Pick<CommentModerationRepositoryPort, 'listRemovals'>;
  paginator: Paginator;
  now: () => number;
}

export interface CommentRemovalPage {
  items: CommentRemovalView[];
  nextCursor: string | null;
}

/** What a moderator visibly removed of the caller's, kept for 30 days so the author can read why. */
export class CommentRemovalService {
  constructor(private readonly deps: CommentRemovalServiceDeps) {}

  async listOwn(
    user: UserContext,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<CommentRemovalPage, InvalidCursor | DatabaseUnavailable>> {
    const { moderation, paginator } = this.deps;
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const since = new Date(this.deps.now() - COMMENT_REMOVAL_RETENTION_DAYS * MS_PER_DAY);
    const rows = await moderation.listRemovals(user.id, { since, cursor: cursor.value, limit });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: ({ id, videoId, excerpt, reason, note, createdAt }) => ({
          id,
          videoId,
          excerpt,
          reason,
          note,
          createdAt: createdAt.toISOString(),
        }),
      })
    );
  }
}
