import type { Result } from '@kit/result';
import type { PostStats } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type PostVoteWritten = 'voted' | 'already_voted' | 'missing';

/** The votes on polls and quizzes, and the per-day counters the team reads as stats. */
export interface PostEngagementRepositoryPort {
  /** One final vote per user: the second answers `already_voted` and changes nothing. */
  vote(
    postId: string,
    userId: string,
    optionIndex: number
  ): Promise<Result<PostVoteWritten, DatabaseUnavailable>>;
  /** The option each post's voter chose; a post the user did not vote on is absent. */
  votedIndexes(
    postIds: readonly string[],
    userId: string
  ): Promise<Result<Map<string, number>, DatabaseUnavailable>>;
  /** Votes per option index for each post that has any; Postgres is the source of truth. */
  tallies(postIds: readonly string[]): Promise<Result<Map<string, number[]>, DatabaseUnavailable>>;
  /** Adds one to the day's opens; the caller already decided this viewer is new today. */
  addOpen(postId: string, day: string): Promise<Result<void, DatabaseUnavailable>>;
  addShareClick(postId: string, day: string): Promise<Result<void, DatabaseUnavailable>>;
  /** Everything the stats sheet shows for one post, read from its own tables. */
  stats(postId: string): Promise<Result<PostStats | null, DatabaseUnavailable>>;
}
