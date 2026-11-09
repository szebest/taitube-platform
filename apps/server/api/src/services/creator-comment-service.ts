import type { CreatorInboxCommentView } from '@vp/api-contracts';
import type { CommentRepositoryPort } from '@vp/core/repositories';
import type { ActingChannel, CreatorInboxFilter } from '@vp/domain';
import { type AuthorizationFailure, decideChannelTask } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, map } from '@vp/result';
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

export type CreatorInboxFailure = AuthorizationFailure | InvalidCursor | DatabaseUnavailable;

/** The comments on the acting channel's videos, for whoever moderates them. */
export class CreatorCommentService {
  constructor(private readonly deps: CreatorCommentServiceDeps) {}

  async inbox(
    user: UserContext,
    acting: ActingChannel,
    options: { filter: CreatorInboxFilter; cursor?: string; limit?: number }
  ): Promise<Result<CreatorInboxPage, CreatorInboxFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'read-inbox' });
    if (isErr(allowed)) return allowed;
    const { ownerId } = allowed.value;

    const { paginator, comments } = this.deps;
    const limit = paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await comments.listForOwner(ownerId, {
      filter: options.filter,
      cursor: cursor.value,
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (comment) => toCreatorInboxCommentView(comment, ownerId),
      })
    );
  }
}
