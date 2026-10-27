import type {
  CommentLocator,
  CommentRepositoryPort,
  ListCommentRepliesOptions,
  ListCommentThreadsOptions,
  ListCreatorInboxOptions,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type Comment,
  type CommentThread,
  type CreatorInboxComment,
  commentCreated,
  type NewCommentInput,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { commentOutbox } from '@vp/job-contracts';
import { fromPromise, map, type Result } from '@vp/result';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope } from '../scopes/index';
import {
  creatorInboxColumns,
  creatorInboxFilterScope,
  toCreatorInboxComment,
} from './comment-inbox-query';
import {
  commentInboxCursorScope,
  commentInboxOrderBy,
  commentReplyCursorScope,
  commentReplyOrderBy,
  commentThreadColumns,
  commentThreadCursorScope,
  commentThreadOrderBy,
  commentWindowBounds,
  toComment,
  toCommentThread,
} from './comment-thread-query';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
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
          const video = await this.lockVideo(tx, input.videoId);
          if (input.parentId !== null && !(await this.isLive(tx, input.parentId))) return null;

          const now = new Date();
          await tx.insert(c).values({ ...input, createdAt: now, updatedAt: now });
          await tx
            .update(v)
            .set({ commentsCount: sql`${v.commentsCount} + 1` })
            .where(eq(v.id, input.videoId));
          await enqueueNotificationJobs(tx, [
            commentOutbox({ videoId: input.videoId, commentId: input.id }),
          ]);
          const created = await this.threadById(tx, input.id);
          if (created && video && video.ownerId !== input.authorId) {
            await appendUserEvent(tx, {
              userId: video.ownerId,
              ...commentCreated(created, { id: input.videoId, title: video.title }),
            });
          }
          return created;
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

  async setHearted(
    target: CommentLocator,
    hearted: boolean
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [updated] = await tx
            .update(c)
            .set({ heartedAt: hearted ? sql`coalesce(${c.heartedAt}, now())` : null })
            .where(
              drizzleWhere(eq(c.id, target.id), eq(c.videoId, target.videoId), notDeletedScope(c))
            )
            .returning({ id: c.id });
          return updated ? this.threadById(tx, target.id) : null;
        }),
      databaseUnavailable.during('heartComment')
    );
  }

  async listForOwner(
    ownerId: string,
    { filter, cursor, limit }: ListCreatorInboxOptions
  ): Promise<Result<CreatorInboxComment[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select(creatorInboxColumns)
          .from(c)
          .innerJoin(v, eq(v.id, c.videoId))
          .leftJoin(ch, eq(ch.userId, c.authorId))
          .where(
            drizzleWhere(
              eq(v.ownerId, ownerId),
              ne(c.authorId, ownerId),
              notDeletedScope(c),
              notDeletedScope(v),
              creatorInboxFilterScope(filter, ownerId),
              commentInboxCursorScope(cursor)
            )
          )
          .orderBy(...commentInboxOrderBy())
          .limit(limit + 1),
      databaseUnavailable.during('listCreatorInbox')
    );
    return map(rows, (found) => found.map(toCreatorInboxComment));
  }

  /**
   * Every write that adds, removes or pins a comment takes the video row first, so a reply cannot
   * commit under a root whose removal is already running, and two pins cannot interleave.
   */
  private async lockVideo(
    tx: PostgresDatabase,
    videoId: string
  ): Promise<{ ownerId: string; title: string } | undefined> {
    const [video] = await tx
      .select({ ownerId: v.ownerId, title: v.title })
      .from(v)
      .where(eq(v.id, videoId))
      .for('update');
    return video;
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
