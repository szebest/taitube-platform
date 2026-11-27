import type { Singleflight } from '@kit/concurrency';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, err, ignore, isErr, map, ok } from '@kit/result';
import type { CommentView, ListCommentsQuery } from '@vp/api-contracts';
import type { CommentCachePort, HotComments } from '@vp/core/ports';
import type { CommentWindow } from '@vp/core/repositories';
import type {
  ActingChannel,
  CommentHost,
  CommentSort,
  CommentTarget,
  CommentThread,
} from '@vp/domain';
import {
  type CommentNotFound,
  type DeleteCommentFailure,
  type HeartCommentFailure,
  type PinCommentFailure,
  type PublicHostReadFailure,
  commentHostTarget,
  commentHostTraits,
  commentNotFound,
  decideCommentDelete,
  decideCommentHeart,
  decideCommentPin,
  decideCommentThreadRead,
  publicHostReadFailure,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { deletionAudit, pinAudit } from './comment-audit';
import {
  type CommentCreateDeps,
  type CreateCommentServiceFailure,
  createComment,
} from './comment-create';
import { commentWithHost, readableHost, visibleCommentWithHost } from './comment-lookup';
import { withOwnComments } from './comment-own-overlay';
import {
  type CommentUpdateDeps,
  type UpdateCommentServiceFailure,
  updateComment,
} from './comment-update';
import { toCommentView } from './comment-views';
import {
  commentThreadCursorPayload,
  createdAtCursorPayload,
  decodeCommentThreadCursor,
  decodeCreatedAtCursor,
} from './cursor';

export interface CommentServiceDeps extends CommentCreateDeps, CommentUpdateDeps {
  commentCache: CommentCachePort;
  singleflight: Singleflight;
  paginator: Paginator;
}

export interface CommentPage {
  items: CommentView[];
  nextCursor: string | null;
}

export type ListCommentsFailure = PublicHostReadFailure | InvalidCursor | DatabaseUnavailable;
export type ListRepliesFailure = ListCommentsFailure | CommentNotFound;
export type DeleteCommentServiceFailure = DeleteCommentFailure | DatabaseUnavailable;
export type PinCommentServiceFailure = PinCommentFailure | DatabaseUnavailable;
export type HeartCommentServiceFailure = HeartCommentFailure | DatabaseUnavailable;

interface ThreadsRequest {
  sort: CommentSort;
  window: CommentWindow;
}

/**
 * Comments under a video or a post. A dead cache costs a query, never an answer, so `CacheUnavailable`
 * appears in no signature here; the repository stays the authority.
 */
export class CommentService {
  constructor(private readonly deps: CommentServiceDeps) {}

  async list(
    viewer: UserContext | null,
    target: CommentTarget,
    query: ListCommentsQuery
  ): Promise<Result<CommentPage & { total: number }, ListCommentsFailure>> {
    const host = await readableHost(this.deps, viewer, target);
    if (isErr(host)) return host;
    const traits = commentHostTraits(host.value);

    const request = this.threadsRequest(query);
    if (isErr(request)) return request;

    const read = await this.threads(viewer, target, traits.commentsCount, request.value);
    if (isErr(read)) return read;
    const own = viewer ? await this.deps.comments.listOwnNonPublic(target, viewer.id) : ok([]);
    if (isErr(own)) return own;

    const { threads, total } = withOwnComments(
      read.value.page,
      own.value,
      request.value.sort,
      read.value.shared
    );
    return ok({
      ...this.deps.paginator.paginate(threads, request.value.window.limit, {
        cursorOf: commentThreadCursorPayload,
        toItem: (thread) => toCommentView(thread, traits, viewer),
      }),
      total,
    });
  }

  async listReplies(
    viewer: UserContext | null,
    commentId: string,
    options: { cursor?: string; limit?: number }
  ): Promise<Result<CommentPage, ListRepliesFailure>> {
    const found = await visibleCommentWithHost(this.deps, viewer, commentId);
    if (isErr(found)) return found;

    const thread = decideCommentThreadRead({ viewer, commentId, ...found.value });
    if (isErr(thread)) {
      const failure = thread.error;
      return err(
        failure.code === ErrorCodes.COMMENT_NOT_FOUND ? failure : publicHostReadFailure(failure)
      );
    }

    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const { comment, host } = thread.value;
    const traits = commentHostTraits(host);
    const rows = await this.deps.comments.listReplies(comment, {
      viewer,
      cursor: cursor.value,
      limit,
    });
    return map(rows, (replies): CommentPage =>
      this.deps.paginator.paginate(replies, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (reply) => toCommentView(reply, traits, viewer),
      })
    );
  }

  async create(
    author: UserContext,
    acting: ActingChannel,
    target: CommentTarget,
    body: { content: string; parentId?: string }
  ): Promise<Result<CommentView, CreateCommentServiceFailure>> {
    const created = await createComment(this.deps, author, acting, target, body);
    if (!isErr(created)) await this.purge(target);
    return created;
  }

  async update(
    actor: UserContext,
    commentId: string,
    content: string
  ): Promise<Result<CommentView, UpdateCommentServiceFailure>> {
    const updated = await updateComment(this.deps, actor, commentId, content);
    if (isErr(updated)) return updated;

    const { thread, host } = updated.value;
    await this.purge(commentHostTarget(host));
    return ok(toCommentView(thread, commentHostTraits(host), actor));
  }

  async remove(
    actor: UserContext,
    commentId: string
  ): Promise<Result<void, DeleteCommentServiceFailure>> {
    const found = await commentWithHost(this.deps, commentId);
    if (isErr(found)) return found;

    const decided = decideCommentDelete({ actor, commentId, ...found.value });
    if (isErr(decided)) return decided;

    const removed = await this.deps.comments.remove(
      decided.value,
      deletionAudit(actor, decided.value)
    );
    if (isErr(removed)) return removed;

    await this.purge(decided.value.target);
    return ok();
  }

  async setPinned(
    actor: UserContext,
    commentId: string,
    pinned: boolean
  ): Promise<Result<CommentView, PinCommentServiceFailure>> {
    const found = await commentWithHost(this.deps, commentId);
    if (isErr(found)) return found;

    const decided = decideCommentPin({ actor, commentId, ...found.value });
    if (isErr(decided)) return decided;

    const updated = await this.deps.comments.setPinned(
      decided.value,
      pinned,
      pinAudit(actor, decided.value, pinned)
    );
    return await this.settled(updated, commentId, found.value.host, actor);
  }

  async setHearted(
    actor: UserContext,
    commentId: string,
    hearted: boolean
  ): Promise<Result<CommentView, HeartCommentServiceFailure>> {
    const found = await commentWithHost(this.deps, commentId);
    if (isErr(found)) return found;

    const decided = decideCommentHeart({ actor, commentId, ...found.value });
    if (isErr(decided)) return decided;

    const updated = await this.deps.comments.setHearted(decided.value, hearted);
    return await this.settled(updated, commentId, found.value.host, actor);
  }

  private threadsRequest(query: ListCommentsQuery) {
    const sort = query.sort ?? 'top';
    const { paginator } = this.deps;

    if (query.page !== undefined) {
      const limit = paginator.limit(query.size ?? query.limit);
      const window: CommentWindow = { type: 'offset', offset: (query.page - 1) * limit, limit };
      return ok<ThreadsRequest>({ sort, window });
    }

    const limit = paginator.limit(query.limit);
    return map(decodeCommentThreadCursor(query.cursor, paginator), (cursor): ThreadsRequest => ({
      sort,
      window: { type: 'keyset', cursor, limit },
    }));
  }

  /** The shared hot page holds public comments only, so it is read and filled as no one in particular. */
  private async threads(
    viewer: UserContext | null,
    target: CommentTarget,
    total: number,
    { sort, window }: ThreadsRequest
  ) {
    const fetchFor = (reader: UserContext | null) => () =>
      this.deps.singleflight.do(
        `comments:${target.type}:${target.id}:${reader?.id ?? 'public'}:${sort}:${JSON.stringify(window)}`,
        async () =>
          map(
            await this.deps.comments.listThreads(target, { viewer: reader, sort, window }),
            (threads): HotComments => ({ threads, total })
          )
      );

    const isHotPage =
      sort === 'top' &&
      window.type === 'keyset' &&
      window.cursor === null &&
      window.limit === this.deps.paginator.defaults.defaultLimit;

    const page = isHotPage
      ? await this.deps.commentCache.getHot(target, fetchFor(null))
      : await fetchFor(viewer)();
    return map(page, (found) => ({ page: found, shared: isHotPage }));
  }

  private async settled(
    written: Result<CommentThread | null, DatabaseUnavailable>,
    commentId: string,
    host: CommentHost | null,
    viewer: UserContext
  ) {
    if (isErr(written)) return written;
    if (!(written.value && host)) return err(commentNotFound(commentId));

    await this.purge(commentHostTarget(host));
    return ok(toCommentView(written.value, commentHostTraits(host), viewer));
  }

  private async purge(target: CommentTarget): Promise<void> {
    ignore(
      await this.deps.commentCache.invalidate(target),
      'the write is committed; the hot page expires on its own TTL'
    );
  }
}
