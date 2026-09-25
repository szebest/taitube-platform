import type {
  CommentLocator,
  CommentRepositoryPort,
  ListCommentRepliesOptions,
  ListCommentThreadsOptions,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Comment, CommentThread, NewCommentInput } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope } from '../scopes/index';
import {
  commentReplyCursorScope,
  commentReplyOrderBy,
  commentThreadColumns,
  commentThreadCursorScope,
  commentThreadOrderBy,
  commentWindowBounds,
  toComment,
  toCommentThread,
} from './comment-thread-query';
import type { PostgresDatabase } from './types';

const { videoComments: c, channels: ch, videos: v } = schema;

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
        this.threads(this.db)
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
        this.threads(this.db)
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
      () =>
        this.db.transaction(async (tx) => {
          await this.lockVideo(tx, input.videoId);
          if (input.parentId !== null && !(await this.isLive(tx, input.parentId))) return null;

          const now = new Date();
          await tx.insert(c).values({ ...input, createdAt: now, updatedAt: now });
          await tx
            .update(v)
            .set({ commentsCount: sql`${v.commentsCount} + 1` })
            .where(eq(v.id, input.videoId));
          return this.threadById(tx, input.id);
        }),
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
          return updated ? this.threadById(tx, id) : null;
        }),
      databaseUnavailable.during('updateComment')
    );
  }

  async remove(target: CommentLocator): Promise<Result<number, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await this.lockVideo(tx, target.videoId);
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
          await this.lockVideo(tx, target.videoId);
          if (!(await this.isLive(tx, target.id))) return null;
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
          return updated ? this.threadById(tx, target.id) : null;
        }),
      databaseUnavailable.during('pinComment')
    );
  }

  /**
   * Every write that adds, removes or pins a comment takes the video row first, so a reply cannot
   * commit under a root whose removal is already running, and two pins cannot interleave.
   */
  private async lockVideo(tx: PostgresDatabase, videoId: string): Promise<void> {
    await tx.select({ id: v.id }).from(v).where(eq(v.id, videoId)).for('update');
  }

  private async isLive(tx: PostgresDatabase, id: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: c.id })
      .from(c)
      .where(drizzleWhere(eq(c.id, id), notDeletedScope(c)))
      .for('update');
    return Boolean(row);
  }

  private threads(db: PostgresDatabase) {
    return db
      .select(commentThreadColumns)
      .from(c)
      .leftJoin(ch, eq(ch.userId, c.authorId))
      .$dynamic();
  }

  private async threadById(db: PostgresDatabase, id: string): Promise<CommentThread | null> {
    const [row] = await this.threads(db).where(eq(c.id, id));
    return row ? toCommentThread(row) : null;
  }
}
