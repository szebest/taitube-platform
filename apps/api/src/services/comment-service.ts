import type { CommentView, ListCommentsQuery } from '@vp/api-contracts';
import type { Singleflight } from '@vp/concurrency';
import type { CommentCachePort, HotComments } from '@vp/core/ports';
import type { CommentRepositoryPort, CommentWindow, VideoRepository } from '@vp/core/repositories';
import type { Comment, CommentSort, CommentThread, Video } from '@vp/domain';
import {
  type CommentNotFound,
  type CreateCommentFailure,
  type DeleteCommentFailure,
  type PinCommentFailure,
  type UpdateCommentFailure,
  commentNotFound,
  decideCommentCreate,
  decideCommentDelete,
  decideCommentPin,
  decideCommentThreadRead,
  decideCommentUpdate,
  decideVideoRead,
  publicReadFailure,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ignore, isErr, map, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { toCommentView } from './comment-views';
import {
  commentThreadCursorPayload,
  createdAtCursorPayload,
  decodeCommentThreadCursor,
  decodeCreatedAtCursor,
} from './cursor';

export interface CommentServiceDeps {
  comments: CommentRepositoryPort;
  videos: VideoRepository;
  commentCache: CommentCachePort;
  singleflight: Singleflight;
  paginator: Paginator;
}

export interface CommentPage {
  items: CommentView[];
  nextCursor: string | null;
}

type PublicReadFailure = ReturnType<typeof publicReadFailure>;

export type ListCommentsFailure = PublicReadFailure | InvalidCursor | DatabaseUnavailable;
export type ListRepliesFailure = ListCommentsFailure | CommentNotFound;
export type CreateCommentServiceFailure =
  | CreateCommentFailure
  | PublicReadFailure
  | DatabaseUnavailable;
export type UpdateCommentServiceFailure = UpdateCommentFailure | DatabaseUnavailable;
export type DeleteCommentServiceFailure = DeleteCommentFailure | DatabaseUnavailable;
export type PinCommentServiceFailure = PinCommentFailure | DatabaseUnavailable;

interface ThreadsRequest {
  sort: CommentSort;
  window: CommentWindow;
}

/**
 * Comments under a video. A dead cache costs a query, never an answer, so `CacheUnavailable`
 * appears in no signature here; the repository stays the authority.
 */
export class CommentService {
  constructor(private readonly deps: CommentServiceDeps) {}

  async listForVideo(
    viewer: UserContext | null,
    videoId: string,
    query: ListCommentsQuery
  ): Promise<Result<CommentPage & { total: number }, ListCommentsFailure>> {
    const video = await this.readableVideo(viewer, videoId);
    if (isErr(video)) return video;

    const request = this.threadsRequest(query);
    if (isErr(request)) return request;

    const hot = await this.threads(video.value, request.value);
    return map(hot, ({ threads, total }) => ({
      ...this.deps.paginator.paginate(threads, request.value.window.limit, {
        cursorOf: commentThreadCursorPayload,
        toItem: (thread) => toCommentView(thread, video.value.ownerId),
      }),
      total,
    }));
  }

  async listReplies(
    viewer: UserContext | null,
    commentId: string,
    options: { cursor?: string; limit?: number }
  ): Promise<Result<CommentPage, ListRepliesFailure>> {
    const found = await this.commentWithVideo(commentId);
    if (isErr(found)) return found;

    const thread = decideCommentThreadRead({ viewer, commentId, ...found.value });
    if (isErr(thread)) {
      const failure = thread.error;
      return err(
        failure.code === ErrorCodes.COMMENT_NOT_FOUND ? failure : publicReadFailure(failure)
      );
    }

    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const { comment, video } = thread.value;
    const rows = await this.deps.comments.listReplies(comment, { cursor: cursor.value, limit });
    return map(
      rows,
      (replies): CommentPage =>
        this.deps.paginator.paginate(replies, limit, {
          cursorOf: createdAtCursorPayload,
          toItem: (reply) => toCommentView(reply, video.ownerId),
        })
    );
  }

  async create(
    author: UserContext,
    videoId: string,
    body: { content: string; parentId?: string }
  ): Promise<Result<CommentView, CreateCommentServiceFailure>> {
    const video = await this.readableVideo(author, videoId);
    if (isErr(video)) return video;
    const parentId = body.parentId ?? null;
    const parent = parentId ? await this.deps.comments.findById(parentId) : ok(null);
    if (isErr(parent)) return parent;

    const decided = decideCommentCreate({
      author,
      video: video.value,
      videoId,
      parent: parent.value,
      parentId,
      content: body.content,
    });
    if (isErr(decided)) return decided;

    const created = await this.deps.comments.create({
      id: uuidv7(),
      videoId,
      authorId: author.id,
      parentId: decided.value.parentId,
      content: decided.value.content,
    });
    if (isErr(created)) return created;

    await this.purge(videoId);
    return ok(toCommentView(created.value, decided.value.video.ownerId));
  }

  async update(
    actor: UserContext,
    commentId: string,
    content: string
  ): Promise<Result<CommentView, UpdateCommentServiceFailure>> {
    const found = await this.commentWithVideo(commentId);
    if (isErr(found)) return found;
    const { comment, video } = found.value;

    const decided = decideCommentUpdate({ actor, comment, commentId, content });
    if (isErr(decided)) return decided;

    const updated = await this.deps.comments.updateContent(commentId, decided.value.content);
    return await this.settled(updated, commentId, video);
  }

  async remove(
    actor: UserContext,
    commentId: string
  ): Promise<Result<void, DeleteCommentServiceFailure>> {
    const found = await this.commentWithVideo(commentId);
    if (isErr(found)) return found;

    const decided = decideCommentDelete({ actor, commentId, ...found.value });
    if (isErr(decided)) return decided;

    const removed = await this.deps.comments.remove(decided.value);
    if (isErr(removed)) return removed;

    await this.purge(decided.value.videoId);
    return ok();
  }

  async setPinned(
    actor: UserContext,
    commentId: string,
    pinned: boolean
  ): Promise<Result<CommentView, PinCommentServiceFailure>> {
    const found = await this.commentWithVideo(commentId);
    if (isErr(found)) return found;
    const { video } = found.value;

    const decided = decideCommentPin({ actor, commentId, ...found.value });
    if (isErr(decided)) return decided;

    const updated = await this.deps.comments.setPinned(decided.value, pinned);
    return await this.settled(updated, commentId, video);
  }

  private async readableVideo(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<Video, DatabaseUnavailable | PublicReadFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideVideoRead({ viewer, video: found.value, videoId });
    return isErr(decided) ? err(publicReadFailure(decided.error)) : decided;
  }

  private async commentWithVideo(commentId: string) {
    const comment = await this.deps.comments.findById(commentId);
    if (isErr(comment)) return comment;
    if (!comment.value) return ok({ comment: null, video: null });

    const video = await this.deps.videos.findById(comment.value.videoId);
    return map(video, (found): { comment: Comment | null; video: Video | null } => ({
      comment: comment.value,
      video: found,
    }));
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
    return map(
      decodeCommentThreadCursor(query.cursor, paginator),
      (cursor): ThreadsRequest => ({ sort, window: { type: 'keyset', cursor, limit } })
    );
  }

  private async threads(video: Video, { sort, window }: ThreadsRequest) {
    const fetch = () =>
      this.deps.singleflight.do(
        `comments:${video.id}:${sort}:${JSON.stringify(window)}`,
        async () =>
          map(
            await this.deps.comments.listThreads(video.id, { sort, window }),
            (threads): HotComments => ({ threads, total: video.commentsCount ?? 0 })
          )
      );

    const isHotPage =
      sort === 'top' &&
      window.type === 'keyset' &&
      window.cursor === null &&
      window.limit === this.deps.paginator.defaults.defaultLimit;

    return isHotPage ? await this.deps.commentCache.getHot(video.id, fetch) : await fetch();
  }

  private async settled(
    written: Result<CommentThread | null, DatabaseUnavailable>,
    commentId: string,
    video: Video | null
  ) {
    if (isErr(written)) return written;
    if (!(written.value && video)) return err(commentNotFound(commentId));

    await this.purge(video.id);
    return ok(toCommentView(written.value, video.ownerId));
  }

  private async purge(videoId: string): Promise<void> {
    ignore(
      await this.deps.commentCache.invalidate(videoId),
      'the write is committed; the hot page expires on its own TTL'
    );
  }
}
