import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, isErr, ok } from '@kit/result';
import type { PostView } from '@vp/api-contracts';
import type { PostEngagementRepositoryPort } from '@vp/core/repositories';
import type { ChannelPost, PostPayload } from '@vp/domain';
import { decidePollVisibility, isPollClosed, pollOf } from '@vp/domain-rules';
import { type UserContext, canManagePost } from '@vp/permissions';

export interface PostViewer {
  user: UserContext | null;
  now: Date;
}

export interface PollLookups {
  voted: ReadonlyMap<string, number>;
  tallies: ReadonlyMap<string, number[]>;
}

type PollBody = Extract<PostView['body'], { kind: 'poll' | 'quiz' }>;

export async function loadPollLookups(
  engagement: Pick<PostEngagementRepositoryPort, 'votedIndexes' | 'tallies'>,
  posts: readonly ChannelPost[],
  viewer: PostViewer
): Promise<Result<PollLookups, DatabaseUnavailable>> {
  const ids = posts.filter((post) => pollOf(post.payload)).map((post) => post.id);
  if (ids.length === 0) return ok({ voted: new Map(), tallies: new Map() });
  const tallies = await engagement.tallies(ids);
  if (isErr(tallies)) return tallies;
  const voted = viewer.user
    ? await engagement.votedIndexes(ids, viewer.user.id)
    : ok(new Map<string, number>());
  if (isErr(voted)) return voted;
  return ok({ voted: voted.value, tallies: tallies.value });
}

function isTeam(viewer: PostViewer, post: ChannelPost, ownerId: string): boolean {
  return canManagePost({
    user: viewer.user,
    action: 'create',
    post: { ownerId, channelId: post.channelId },
  });
}

/** The question always shows; counts, and a quiz's answer, only to who may see them: after voting, after the close, or to the team. */
export function pollBodyOf(
  post: ChannelPost,
  poll: Extract<PostPayload, { kind: 'poll' | 'quiz' }>,
  ownerId: string,
  lookups: PollLookups,
  viewer: PostViewer
): PollBody {
  const votedIndex = lookups.voted.get(post.id) ?? null;
  const shown = decidePollVisibility({
    payload: post.payload,
    votedIndex,
    isMember: isTeam(viewer, post, ownerId),
    now: viewer.now,
  });
  const counts = lookups.tallies.get(post.id) ?? [];
  const options = poll.options.map((text, index) => ({
    text,
    votes: shown.results ? (counts[index] ?? 0) : null,
  }));
  const common = {
    question: poll.question,
    options,
    closesAt: poll.closesAt,
    closed: isPollClosed(poll, viewer.now),
    votedIndex,
    totalVotes: shown.results
      ? options.reduce((sum, option) => sum + (option.votes ?? 0), 0)
      : null,
  };
  return answered(poll, common, shown.answer);
}

function answered(
  payload: Extract<PostPayload, { kind: 'poll' | 'quiz' }>,
  common: Omit<Extract<PollBody, { kind: 'poll' }>, 'kind'>,
  reveal: boolean
): PollBody {
  if (payload.kind !== 'quiz') return { kind: 'poll', ...common };
  return {
    kind: 'quiz',
    ...common,
    correctIndex: reveal ? payload.correctIndex : null,
    explanation: reveal ? payload.explanation : null,
  };
}
