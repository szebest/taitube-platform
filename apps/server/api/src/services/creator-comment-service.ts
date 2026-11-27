import type { DatabaseUnavailable } from '@kit/errors';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, isErr, ok } from '@kit/result';
import type { CreatorInboxCommentView } from '@vp/api-contracts';
import type {
  CommentReplyCursor,
  CommentRepositoryPort,
  VideoRepository,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import type { ActingChannel, CreatorInboxComment, CreatorInboxFilter } from '@vp/domain';
import { type AuthorizationFailure, decideChannelTask } from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { toCreatorInboxCommentView } from './comment-views';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import { heldThreadInboxRow } from './thread-inbox';

export interface CreatorCommentServiceDeps {
  comments: CommentRepositoryPort;
  threads: Pick<VideoThreadRepositoryPort, 'listHeld'>;
  videos: Pick<VideoRepository, 'findById'>;
  paginator: Paginator;
}

/** A held thread waits for a moderator as a held comment does, so only these filters list it. */
const THREAD_FILTERS: readonly CreatorInboxFilter[] = ['all', 'held'];

function newestFirst(a: CreatorInboxComment, b: CreatorInboxComment): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
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
    options: { filter: CreatorInboxFilter; authorId?: string; cursor?: string; limit?: number }
  ): Promise<Result<CreatorInboxPage, CreatorInboxFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'read-inbox' });
    if (isErr(allowed)) return allowed;
    const scope = allowed.value;

    const { paginator, comments } = this.deps;
    const limit = paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await comments.listForOwner(scope.ownerId, {
      channelId: scope.channelId,
      filter: options.filter,
      authorId: options.authorId,
      cursor: cursor.value,
      limit,
    });
    if (isErr(rows)) return rows;
    const heldThreads = await this.heldThreadRows(
      scope.channelId,
      options,
      cursor.value,
      limit + 1
    );
    if (isErr(heldThreads)) return heldThreads;
    const merged = [...rows.value, ...heldThreads.value].sort(newestFirst).slice(0, limit + 1);
    return ok(
      paginator.paginate(merged, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (comment) => toCreatorInboxCommentView(comment, scope, user),
      })
    );
  }

  private async heldThreadRows(
    channelId: string,
    options: { filter: CreatorInboxFilter; authorId?: string },
    cursor: CommentReplyCursor | null,
    limit: number
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>> {
    if (!THREAD_FILTERS.includes(options.filter)) return ok([]);
    const { threads, videos } = this.deps;
    const held = await threads.listHeld({ channelId, authorId: options.authorId, cursor, limit });
    if (isErr(held)) return held;

    const rows: CreatorInboxComment[] = [];
    for (const entry of held.value) {
      const video = await videos.findById(entry.thread.videoId);
      if (isErr(video)) return video;
      if (video.value) {
        rows.push(
          heldThreadInboxRow(entry, { id: video.value.id, title: video.value.title ?? '' })
        );
      }
    }
    return ok(rows);
  }
}
