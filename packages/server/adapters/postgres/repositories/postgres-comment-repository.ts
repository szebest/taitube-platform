import type {
  CommentLocator,
  CommentViewer,
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
  type ModerationRecord,
  type NewChannelAuditEntry,
  type NewCommentInput,
  type NewCommentRemoval,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { heartOutbox } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { fromPromise, map, type Result } from '@vp/result';
import { eq, not, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope, publicCommentScope } from '../scopes/index';
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
import { insertComment, pinComment, removeComment } from './comment-writes';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';

const { videoComments: c } = schema;

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

  async findVisible(
    viewer: CommentViewer,
    id: string
  ): Promise<Result<Comment | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(c)
          .where(drizzleWhere(eq(c.id, id), notDeletedScope(c), publicCommentScope(viewer))),
      databaseUnavailable.during('findVisibleComment')
    );
    return map(rows, ([row]) => (row ? toComment(row) : null));
  }

  async listThreads(
    videoId: string,
    { viewer, sort, window }: ListCommentThreadsOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const { cursor, offset } = commentWindowBounds(window);
    const rows = await fromPromise(
      () =>
        selectThreads(this.db, viewer)
          .where(
            drizzleWhere(
              eq(c.videoId, videoId),
              sql`${c.parentId} IS NULL`,
              notDeletedScope(c),
              publicCommentScope(viewer),
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
    { viewer, cursor, limit }: ListCommentRepliesOptions
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        selectThreads(this.db, viewer)
          .where(
            drizzleWhere(
              eq(c.videoId, root.videoId),
              eq(c.parentId, root.id),
              notDeletedScope(c),
              publicCommentScope(viewer),
              commentReplyCursorScope(cursor)
            )
          )
          .orderBy(...commentReplyOrderBy())
          .limit(limit + 1),
      databaseUnavailable.during('listCommentReplies')
    );
    return map(rows, (found) => found.map(toCommentThread));
  }

  async listOwnNonPublic(
    videoId: string,
    authorId: string
  ): Promise<Result<CommentThread[], DatabaseUnavailable>> {
    const viewer = { id: authorId };
    const rows = await fromPromise(
      () =>
        selectThreads(this.db, viewer)
          .where(
            drizzleWhere(
              eq(c.videoId, videoId),
              eq(c.authorId, authorId),
              notDeletedScope(c),
              publicCommentScope(viewer),
              not(publicCommentScope(null))
            )
          )
          .orderBy(...commentThreadOrderBy('newest')),
      databaseUnavailable.during('listOwnNonPublicComments')
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
            .returning({ authorId: c.authorId });
          return updated ? threadById(tx, id, { id: updated.authorId }) : null;
        }),
      databaseUnavailable.during('updateComment')
    );
  }

  async remove(
    target: CommentLocator,
    record?: ModerationRecord & { removal?: NewCommentRemoval }
  ): Promise<Result<number, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => removeComment(tx, target, record)),
      databaseUnavailable.during('removeComment')
    );
  }

  async setPinned(
    target: CommentLocator,
    pinned: boolean,
    audit?: NewChannelAuditEntry
  ): Promise<Result<CommentThread | null, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => pinComment(tx, target, pinned, audit)),
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
          return threadById(tx, target.id, null);
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
