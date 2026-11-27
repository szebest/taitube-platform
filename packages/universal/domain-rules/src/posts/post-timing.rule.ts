import { type Result, err, ok } from '@kit/result';
import type { PostStatus } from '@vp/domain';
import { type PostScheduleInvalid, postScheduleInvalid } from './failures';

export type PostTiming =
  | { readonly mode: 'now' }
  | { readonly mode: 'draft' }
  | { readonly mode: 'schedule'; readonly publishAt: Date };

export interface PostTimingInput {
  readonly current: PostStatus | null;
  readonly timing: PostTiming;
  readonly now: Date;
}

export type PostTimingDecision =
  | { readonly status: 'published' }
  | { readonly status: 'draft'; readonly publishAt: null }
  | { readonly status: 'scheduled'; readonly publishAt: Date };

/** What a post becomes when saved with a timing; a published post only ever stays published. */
export function decidePostTiming(
  input: PostTimingInput
): Result<PostTimingDecision, PostScheduleInvalid> {
  const { current, timing, now } = input;
  if (current === 'published') {
    return timing.mode === 'now'
      ? ok({ status: 'published' })
      : err(postScheduleInvalid('already_published'));
  }
  switch (timing.mode) {
    case 'now':
      return ok({ status: 'published' });
    case 'draft':
      return ok({ status: 'draft', publishAt: null });
    case 'schedule':
      return timing.publishAt > now
        ? ok({ status: 'scheduled', publishAt: timing.publishAt })
        : err(postScheduleInvalid('in_past'));
  }
}
