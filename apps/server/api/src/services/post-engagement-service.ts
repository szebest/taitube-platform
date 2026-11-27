import { type Result, err, ignore, isErr, ok } from '@kit/result';
import type { PostView } from '@vp/api-contracts';
import type { PostOpenSketchPort } from '@vp/core/ports';
import type {
  ChannelUserRestrictionRepositoryPort,
  PostEngagementRepositoryPort,
} from '@vp/core/repositories';
import {
  type AuthorizationFailure,
  type CommentsBanned,
  type PollVoteFailure,
  type PostAlreadyVoted,
  type PostNotFound,
  decidePollVote,
  decidePostReact,
  postAlreadyVoted,
  postNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { refuseWhileBanned } from './channel-ban';
import type { PostService } from './post-service';

export interface PostEngagementServiceDeps {
  posts: Pick<PostService, 'get' | 'channelOf'>;
  engagement: PostEngagementRepositoryPort;
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
  openSketch: PostOpenSketchPort;
  now: () => number;
}

export type VoteFailure =
  | AuthorizationFailure
  | CommentsBanned
  | PollVoteFailure
  | PostAlreadyVoted
  | PostNotFound
  | DatabaseUnavailable;

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Votes and answers, and the two beacons whose counts only the team reads. */
export class PostEngagementService {
  constructor(private readonly deps: PostEngagementServiceDeps) {}

  async vote(
    user: UserContext,
    postId: string,
    optionIndex: number
  ): Promise<Result<PostView, VoteFailure>> {
    const { posts, engagement } = this.deps;
    const now = new Date(this.deps.now());
    const voter = decidePostReact(user);
    if (isErr(voter)) return voter;
    const post = await posts.channelOf(postId);
    if (isErr(post)) return post;

    const banned = await refuseWhileBanned(this.deps, post.value.channelId, user.id, now);
    if (isErr(banned)) return banned;
    const option = decidePollVote({ post: post.value, optionIndex, now });
    if (isErr(option)) return option;

    const written = await engagement.vote(postId, user.id, option.value);
    if (isErr(written)) return written;
    if (written.value === 'missing') return err(postNotFound(postId));
    if (written.value === 'already_voted') return err(postAlreadyVoted(postId));
    return posts.get(user, postId);
  }

  async recordOpen(
    viewer: UserContext | null,
    viewerAddress: string,
    postId: string
  ): Promise<Result<void, PostNotFound | DatabaseUnavailable>> {
    const post = await this.deps.posts.channelOf(postId);
    if (isErr(post)) return post;
    const day = dayOf(this.deps.now());
    const fresh = await this.deps.openSketch.record(postId, viewer?.id ?? viewerAddress, day);
    if (isErr(fresh)) {
      ignore(fresh, 'an open lost to a dead cache is one fewer on a counter, not a failed page');
      return ok();
    }
    return fresh.value ? this.deps.engagement.addOpen(postId, day) : ok();
  }

  async recordShareClick(
    postId: string
  ): Promise<Result<void, PostNotFound | DatabaseUnavailable>> {
    const post = await this.deps.posts.channelOf(postId);
    if (isErr(post)) return post;
    return this.deps.engagement.addShareClick(postId, dayOf(this.deps.now()));
  }
}
