import { type Result, err, ok } from '@kit/result';
import type { ChannelPost, PostPayload } from '@vp/domain';
import { type PostPollLocked, postPollLocked } from './failures';
import { pollOf } from './poll';

export interface PollLockInput {
  readonly post: ChannelPost;
  readonly next: PostPayload;
  readonly voteCount: number;
}

function sameChoices(a: PostPayload, b: PostPayload): boolean {
  const left = pollOf(a);
  const right = pollOf(b);
  return (
    left !== null &&
    right !== null &&
    left.kind === right.kind &&
    left.question === right.question &&
    JSON.stringify(left.options) === JSON.stringify(right.options) &&
    (left.kind !== 'quiz' || (right.kind === 'quiz' && left.correctIndex === right.correctIndex))
  );
}

/** Once anyone voted the question, the options and a quiz's answer stay; the close time and explanation may still move. */
export function decidePollUnlocked(input: PollLockInput): Result<void, PostPollLocked> {
  const { post, next, voteCount } = input;
  if (voteCount === 0 || pollOf(post.payload) === null) return ok(undefined);
  return sameChoices(post.payload, next) ? ok(undefined) : err(postPollLocked(post.id));
}
