import type {
  CommentLocator,
  CommentRepositoryPort,
  ListCommentRepliesOptions,
  ListAuthoredCommentsOptions,
  ListCommentThreadsOptions,
  ListCreatorInboxOptions,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type AuthoredComment,
  type Comment,
  type CommentThread,
  type CreatorInboxComment,
  type NewCommentInput,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { heartOutbox } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { fromPromise, map, type Result } from '@vp/result';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope } from '../scopes/index';
import { toCreatorInboxComment } from './comment-inbox-query';
import {
  authoredCommentsQuery,
  creatorInboxQuery,
  toAuthoredComment,
} from './comment-list-queries';
import {
  commentReplyCursorScope,
  commentReplyOrderBy,
  commentThreadCursorScope,
  commentThreadOrderBy,
  commentWindowBounds,
  toComment,
  selectThreads,
  threadById,
  toCommentThread,
} from './comment-thread-query';
import { insertComment, isLive, lockVideo } from './comment-writes';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';

const { videoComments: c, videos: v } = schema;

export class PostgresCommentRepository implements CommentRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Result<Comment | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(c)
          .where(drizzleWhere(eq(c.id, id), notDeletedScope(c))),
      databaseUnavailable.during('findComment')
    );
    return map(rows, ([row]) => (row ? toComment(row) : null));
  }

  async listThreads(
    videoId: string,
    { sort, window }: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const { cursor, offset } = commentWindowBounds(window);
    const rows = await fromPromise(
      () =>
        selectThreads(this.db)
          .where(
            drizzleWhere(
              eq(c.videoId, videoId),
              sql`${c.parentId} IS NULL`,
              notDeletedScope(c),
              commentThreadCursorScope(sort, cursor)
            )
          )
          .orderBy(...commentThreadOrderBy(sort))
          .limit(window.limit + 1)
          .offset(offset),
      databaseUnavailable.during('listCommentThreads')
    );
    return map(rows, (found) => found.map(toCommentThread));
  }

  async listReplies(
    root: CommentLocator,
    { cursor, limit }: ListCommentRepliesOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        selectThreads(this.db)
          .where(
            drizzleWhere(
              eq(c.videoId, root.videoId),
              eq(c.parentId, root.id),
              notDeletedScope(c),
              commentReplyCursorScope(cursor)
            )
          )
          .orderBy(...commentReplyOrderBy())
          .limit(limit + 1),
      databaseUnavailable.during('listCommentReplies')
    );
    return map(rows, (found) => found.map(toCommentThread));
  }

  async create(input: NewCommentInput): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => insertComment(tx, input)),
      databaseUnavailable.during('createComment')
    );
  }

  async updateContent(
    id: string,
    content: string
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [updated] = await tx
            .update(c)
            .set({ content, isEdited: true, updatedAt: new Date() })
            .where(drizzleWhere(eq(c.id, id), notDeletedScope(c)))
            .returning({ id: c.id });
          return updated ? threadById(tx, id) : null;
        }),
      databaseUnavailable.during('updateComment')
    );
  }

  async remove(target: CommentLocator): Promise<Result<number, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await lockVideo(tx, target.videoId);
          const removed = await tx
            .update(c)
            .set({ deletedAt: new Date(), isPinned: false })
            .where(
              drizzleWhere(
                eq(c.videoId, target.videoId),
                or(eq(c.id, target.id), eq(c.parentId, target.id)),
                notDeletedScope(c)
              )
            )
            .returning({ id: c.id });
          if (removed.length > 0) {
            await tx
              .update(v)
              .set({ commentsCount: sql`GREATEST(0, ${v.commentsCount} - ${removed.length})` })
              .where(eq(v.id, target.videoId));
          }
          return removed.length;
        }),
      databaseUnavailable.during('removeComment')
    );
  }

  async setPinned(
    target: CommentLocator,
    pinned: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await lockVideo(tx, target.videoId);
          if (!(await isLive(tx, target.id))) return null;
          if (pinned) {
            await tx
              .update(c)
              .set({ isPinned: false })
              .where(and(eq(c.videoId, target.videoId), eq(c.isPinned, true), ne(c.id, target.id)));
          }
          const [updated] = await tx
            .update(c)
            .set({ isPinned: pinned, updatedAt: new Date() })
            .where(drizzleWhere(eq(c.id, target.id), notDeletedScope(c)))
            .returning({ id: c.id });
          return updated ? threadById(tx, target.id) : null;
        }),
      databaseUnavailable.during('pinComment')
    );
  }

  async setHearted(
    target: CommentLocator,
    hearted: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const where = drizzleWhere(
            eq(c.id, target.id),
            eq(c.videoId, target.videoId),
            notDeletedScope(c)
          );
          const [before] = await tx
            .select({ heartedAt: c.heartedAt })
            .from(c)
            .where(where)
            .for('update');
          if (!before) return null;

          await tx
            .update(c)
            .set({ heartedAt: hearted ? sql`coalesce(${c.heartedAt}, now())` : null })
            .where(eq(c.id, target.id));
          if (hearted && before.heartedAt === null) {
            await enqueueNotificationJobs(tx, [
              heartOutbox({ videoId: target.videoId, commentId: target.id }),
            ]);
          }
          return threadById(tx, target.id);
        }),
      databaseUnavailable.during('heartComment')
    );
  }

  async listForOwner(
    ownerId: string,
    options: ListCreatorInboxOptions
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => creatorInboxQuery(this.db, ownerId, options),
      databaseUnavailable.during('listCreatorInbox')
    );
    return map(rows, (found) => found.map(toCreatorInboxComment));
  }

  async listByAuthor(
    viewer: UserContext,
    options: ListAuthoredCommentsOptions
  ): Promise<Result<AuthoredComment[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => authoredCommentsQuery(this.db, viewer, options),
      databaseUnavailable.during('listAuthoredComments')
    );
    return map(rows, (found) => found.map(toAuthoredComment));
  }
}
