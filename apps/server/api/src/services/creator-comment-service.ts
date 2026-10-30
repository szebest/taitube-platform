import type { CreatorInboxCommentView } from '@vp/api-contracts';
import type { CommentRepositoryPort } from '@vp/core/repositories';
import type { CreatorInboxFilter } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { isErr, map, type Result } from '@vp/result';
import { toCreatorInboxCommentView } from './comment-views';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface CreatorCommentServiceDeps {
  comments: CommentRepositoryPort;
  paginator: Paginator;
}

export interface CreatorInboxPage {
  items: CreatorInboxCommentView[];
  nextCursor: string | null;
}

export type CreatorInboxFailure = InvalidCursor | DatabaseUnavailable;

/** The inbox is scoped to the caller's own videos by the query, so it asks no permission. */
export class CreatorCommentService {
  constructor(private readonly deps: CreatorCommentServiceDeps) {}

  async inbox(
    creator: UserContext,
    options: { filter: CreatorInboxFilter; cursor?: string; limit?: number }
  ): Promise<Result<CreatorInboxPage, CreatorInboxFailure>> {
    const { paginator, comments } = this.deps;
    const limit = paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await comments.listForOwner(creator.id, {
      filter: options.filter,
      cursor: cursor.value,
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (comment) => toCreatorInboxCommentView(comment, creator.id),
      })
    );
  }
}
