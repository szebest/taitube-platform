import { type Result, err, ok } from '@kit/result';
import type { ChannelPost } from '@vp/domain';
import { type InvalidPostPayload, invalidPostOptionIndex } from '@vp/validation';
import { type PostPollClosed, postPollClosed } from './failures';
import { isPollClosed, pollOf } from './poll';

export interface PollVoteInput {
  readonly post: ChannelPost;
  readonly optionIndex: number;
  readonly now: Date;
}

export type PollVoteFailure = PostPollClosed | InvalidPostPayload;

export function decidePollVote(input: PollVoteInput): Result<number, PollVoteFailure> {
  const { post, optionIndex, now } = input;
  const poll = pollOf(post.payload);
  if (!poll) return err(invalidPostOptionIndex(0));
  if (isPollClosed(post.payload, now)) return err(postPollClosed(post.id));
  const inRange =
    Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < poll.options.length;
  return inRange ? ok(optionIndex) : err(invalidPostOptionIndex(poll.options.length));
}
