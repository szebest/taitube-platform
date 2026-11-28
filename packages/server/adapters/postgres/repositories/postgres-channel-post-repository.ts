import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, fromPromise, map } from '@kit/result';
import type {
  ChannelPostCreated,
  ChannelPostEdit,
  ListManagedPostsOptions,
  PostWriteLimits,
  ChannelPostEdited,
  ChannelPostRepositoryPort,
  ListChannelPostsOptions,
  PostLikeWritten,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type {
  ChannelPost,
  ChannelPostEntry,
  NewChannelAuditEntry,
  NewChannelPostInput,
  NewPostInput,
  NewUnpublishedPostInput,
  PostPinOutcome,
} from '@vp/domain';
import { postSubscribersOutbox } from '@vp/job-contracts';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import {
  countPendingPosts,
  createPostWithinLimits,
  dueScheduledIds,
  editPostRow,
  insertUnpublishedPost,
  managedPostsPage,
  promotePost,
  setPostPinned,
} from './channel-post-lifecycle-writes';
import { channelPostsPage, feedPostsPage, toChannelPost } from './channel-post-queries';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';

const { channelPosts: p, postReactions: pr } = schema;

export class PostgresChannelPostRepository implements ChannelPostRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async findById(id: string): Promise<Result<ChannelPost | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(p).where(eq(p.id, id)),
      databaseUnavailable.during('findChannelPost')
    );
    return map(rows, ([row]) => (row ? toChannelPost(row) : null));
  }

  async countCreatedSince(
    channelId: string,
    since: Date
  ): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ total: count() })
          .from(p)
          .where(and(eq(p.channelId, channelId), gte(p.createdAt, since))),
      databaseUnavailable.during('countChannelPosts')
    );
    return map(rows, ([row]) => row?.total ?? 0);
  }

  async publish(
    input: NewChannelPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const now = new Date();
          const [row] = await tx
            .insert(p)
            .values({
              ...input,
              kind: input.payload.kind,
              status: 'published',
              publishedAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          if (!row) throw new Error('channel post insert returned no row');
          await appendChannelAudit(tx, audit);
          await enqueueNotificationJobs(tx, [postSubscribersOutbox({ postId: row.id })]);
          return toChannelPost(row);
        }),
      databaseUnavailable.during('publishChannelPost')
    );
  }

  async edit(
    id: string,
    version: number,
    edit: ChannelPostEdit,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPostEdited, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => editPostRow(tx, { id, version, edit, audit })),
      databaseUnavailable.during('editChannelPost')
    );
  }

  async create(
    input: NewPostInput,
    audit: NewChannelAuditEntry,
    limits: PostWriteLimits
  ): Promise<Result<ChannelPostCreated, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => createPostWithinLimits(tx, input, audit, limits)),
      databaseUnavailable.during('createChannelPost')
    );
  }

  async remove(
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const removed = await tx.delete(p).where(eq(p.id, id)).returning({ id: p.id });
          if (removed.length === 0) return false;
          await appendChannelAudit(tx, audit);
          return true;
        }),
      databaseUnavailable.during('removeChannelPost')
    );
  }

  async countPending(channelId: string): Promise<Result<number, DatabaseUnavailable>> {
    return fromPromise(
      () => countPendingPosts(this.db, channelId),
      databaseUnavailable.during('countPendingChannelPosts')
    );
  }

  async saveUnpublished(
    input: NewUnpublishedPostInput,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelPost, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => insertUnpublishedPost(tx, input, audit)),
      databaseUnavailable.during('saveUnpublishedChannelPost')
    );
  }

  async promote(
    id: string,
    audit: NewChannelAuditEntry | null
  ): Promise<Result<ChannelPost | null, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => promotePost(tx, id, audit)),
      databaseUnavailable.during('promoteChannelPost')
    );
  }

  async promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>> {
    return fromPromise(async () => {
      const promoted: string[] = [];
      for (const id of await dueScheduledIds(this.db, now, limit)) {
        const post = await this.db.transaction((tx) => promotePost(tx, id, null));
        if (post) promoted.push(id);
      }
      return promoted;
    }, databaseUnavailable.during('promoteDueChannelPosts'));
  }

  async listManaged(
    channelId: string,
    options: ListManagedPostsOptions
  ): Promise<Result<ChannelPost[], DatabaseUnavailable>> {
    return fromPromise(
      () => managedPostsPage(this.db, channelId, options),
      databaseUnavailable.during('listManagedChannelPosts')
    );
  }

  async setPinned(
    id: string,
    channelId: string,
    pinned: boolean,
    limit: number,
    audit: NewChannelAuditEntry
  ): Promise<Result<PostPinOutcome, DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.transaction((tx) => setPostPinned(tx, { id, channelId, pinned, limit }, audit)),
      databaseUnavailable.during('pinChannelPost')
    );
  }

  async listPublished(
    channelId: string,
    options: ListChannelPostsOptions
  ): Promise<Result<ChannelPostEntry[], DatabaseUnavailable>> {
    return fromPromise(
      () => channelPostsPage(this.db, channelId, options),
      databaseUnavailable.during('listChannelPosts')
    );
  }

  async listFeed(
    subscriberChannelId: string,
    options: ListChannelPostsOptions
  ): Promise<Result<ChannelPostEntry[], DatabaseUnavailable>> {
    return fromPromise(
      () => feedPostsPage(this.db, subscriberChannelId, options),
      databaseUnavailable.during('listCommunityFeed')
    );
  }

  async isLiked(postId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ postId: pr.postId })
          .from(pr)
          .where(and(eq(pr.postId, postId), eq(pr.userId, userId))),
      databaseUnavailable.during('findPostLike')
    );
    return map(rows, (found) => found.length > 0);
  }

  /** The count moves only by a row that was really added or removed, so a retry never counts twice. */
  async setLiked(
    postId: string,
    userId: string,
    liked: boolean
  ): Promise<Result<PostLikeWritten | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [post] = await tx
            .select({ id: p.id })
            .from(p)
            .where(eq(p.id, postId))
            .for('update');
          if (!post) return null;
          const changed = liked
            ? await tx.insert(pr).values({ postId, userId }).onConflictDoNothing().returning()
            : await tx
                .delete(pr)
                .where(and(eq(pr.postId, postId), eq(pr.userId, userId)))
                .returning();
          const delta = changed.length * (liked ? 1 : -1);
          const [row] = await tx
            .update(p)
            .set({ likeCount: sql`${p.likeCount} + ${delta}` })
            .where(eq(p.id, postId))
            .returning({ likeCount: p.likeCount });
          return { liked, likeCount: row?.likeCount ?? 0 };
        }),
      databaseUnavailable.during('likeChannelPost')
    );
  }
}
