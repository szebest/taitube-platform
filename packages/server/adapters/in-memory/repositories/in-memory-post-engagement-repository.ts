import { type Result, ok } from '@kit/result';
import type { PostEngagementRepositoryPort, PostVoteWritten } from '@vp/core/repositories';
import { POLL_OPTION_SLOTS, type ChannelPost, type PostStats } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

interface Days {
  opens: number;
  shareClicks: number;
}

export interface InMemoryPostEngagementOptions {
  posts: { posts: ReadonlyMap<string, ChannelPost> };
}

export class InMemoryPostEngagement implements PostEngagementRepositoryPort {
  private readonly votes = new Map<string, Map<string, number>>();
  private readonly days = new Map<string, Days>();

  constructor(private readonly deps: InMemoryPostEngagementOptions) {}

  async vote(
    postId: string,
    userId: string,
    optionIndex: number
  ): Promise<Result<PostVoteWritten, DatabaseUnavailable>> {
    if (!this.deps.posts.posts.has(postId)) return ok('missing');
    const voters = this.votes.get(postId);
    if (voters?.has(userId)) return ok('already_voted');
    if (voters) voters.set(userId, optionIndex);
    else this.votes.set(postId, new Map([[userId, optionIndex]]));
    return ok('voted');
  }

  async votedIndexes(
    postIds: readonly string[],
    userId: string
  ): Promise<Result<Map<string, number>, DatabaseUnavailable>> {
    const found = new Map<string, number>();
    for (const postId of postIds) {
      const index = this.votes.get(postId)?.get(userId);
      if (index !== undefined) found.set(postId, index);
    }
    return ok(found);
  }

  async tallies(
    postIds: readonly string[]
  ): Promise<Result<Map<string, number[]>, DatabaseUnavailable>> {
    return ok(new Map(postIds.flatMap((id) => (this.votes.has(id) ? [[id, this.tally(id)]] : []))));
  }

  async addOpen(postId: string, day: string): Promise<Result<void, DatabaseUnavailable>> {
    this.day(postId, day).opens += 1;
    return ok();
  }

  async addShareClick(postId: string, day: string): Promise<Result<void, DatabaseUnavailable>> {
    this.day(postId, day).shareClicks += 1;
    return ok();
  }

  async stats(postId: string): Promise<Result<PostStats | null, DatabaseUnavailable>> {
    const post = this.deps.posts.posts.get(postId);
    if (!post) return ok(null);
    const { payload } = post;
    const votes = this.tally(postId);
    const total = votes.reduce((sum, count) => sum + count, 0);
    const poll = payload.kind === 'poll' || payload.kind === 'quiz' ? payload : null;
    const days = [...this.days]
      .filter(([key]) => key.startsWith(`${postId}:`))
      .map(([, value]) => value);
    return ok({
      opens: days.reduce((sum, day) => sum + day.opens, 0),
      shareClicks: days.reduce((sum, day) => sum + day.shareClicks, 0),
      likes: post.likeCount,
      replies: post.commentsCount,
      votesByOption: votes.slice(0, poll?.options.length ?? 0),
      quizCorrectShare:
        payload.kind === 'quiz' && total > 0 ? (votes[payload.correctIndex] ?? 0) / total : null,
    });
  }

  total(postId: string): number {
    return this.votes.get(postId)?.size ?? 0;
  }

  clear(): void {
    this.votes.clear();
    this.days.clear();
  }

  private tally(postId: string): number[] {
    const counts = new Array<number>(POLL_OPTION_SLOTS).fill(0);
    for (const index of this.votes.get(postId)?.values() ?? [])
      counts[index] = (counts[index] ?? 0) + 1;
    return counts;
  }

  private day(postId: string, day: string): Days {
    const key = `${postId}:${day}`;
    const found = this.days.get(key);
    if (found) return found;
    const fresh: Days = { opens: 0, shareClicks: 0 };
    this.days.set(key, fresh);
    return fresh;
  }
}
