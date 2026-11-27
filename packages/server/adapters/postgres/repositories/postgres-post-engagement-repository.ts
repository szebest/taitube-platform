import { type Result, fromPromise } from '@kit/result';
import type { PostEngagementRepositoryPort, PostVoteWritten } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { PostStats } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { eq, sql } from 'drizzle-orm';
import { statsOf, talliesOf, votedIndexesOf } from './post-engagement-queries';
import type { PostgresDatabase } from './types';

const { channelPosts: p, postPollVotes: v, postStatsDaily: d } = schema;

export class PostgresPostEngagementRepository implements PostEngagementRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async vote(
    postId: string,
    userId: string,
    optionIndex: number
  ): Promise<Result<PostVoteWritten, DatabaseUnavailable>> {
    return fromPromise(async (): Promise<PostVoteWritten> => {
      const [post] = await this.db.select({ id: p.id }).from(p).where(eq(p.id, postId));
      if (!post) return 'missing';
      const written = await this.db
        .insert(v)
        .values({ postId, userId, optionIndex })
        .onConflictDoNothing()
        .returning({ postId: v.postId });
      return written.length === 0 ? 'already_voted' : 'voted';
    }, databaseUnavailable.during('votePost'));
  }

  async votedIndexes(
    postIds: readonly string[],
    userId: string
  ): Promise<Result<Map<string, number>, DatabaseUnavailable>> {
    return fromPromise(
      () => votedIndexesOf(this.db, postIds, userId),
      databaseUnavailable.during('findPostVotes')
    );
  }

  async tallies(
    postIds: readonly string[]
  ): Promise<Result<Map<string, number[]>, DatabaseUnavailable>> {
    return fromPromise(
      () => talliesOf(this.db, postIds),
      databaseUnavailable.during('tallyPostVotes')
    );
  }

  async addOpen(postId: string, day: string): Promise<Result<void, DatabaseUnavailable>> {
    return this.bump(postId, day, { opens: 1, shareClicks: 0 }, 'recordPostOpen');
  }

  async addShareClick(postId: string, day: string): Promise<Result<void, DatabaseUnavailable>> {
    return this.bump(postId, day, { opens: 0, shareClicks: 1 }, 'recordPostShareClick');
  }

  async stats(postId: string): Promise<Result<PostStats | null, DatabaseUnavailable>> {
    return fromPromise(() => statsOf(this.db, postId), databaseUnavailable.during('readPostStats'));
  }

  private async bump(
    postId: string,
    day: string,
    by: { opens: number; shareClicks: number },
    during: string
  ): Promise<Result<void, DatabaseUnavailable>> {
    return fromPromise(async () => {
      await this.db
        .insert(d)
        .values({ postId, day, ...by })
        .onConflictDoUpdate({
          target: [d.postId, d.day],
          set: {
            opens: sql`${d.opens} + ${by.opens}`,
            shareClicks: sql`${d.shareClicks} + ${by.shareClicks}`,
          },
        });
    }, databaseUnavailable.during(during));
  }
}
