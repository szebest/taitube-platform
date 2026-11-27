import type { PostPayload } from '@vp/domain';
import { isPollClosed } from './poll';

export interface PollVisibilityInput {
  readonly payload: PostPayload;
  readonly votedIndex: number | null;
  readonly isMember: boolean;
  readonly now: Date;
}

export interface PollVisibility {
  readonly results: boolean;
  readonly answer: boolean;
}

/** Results show after voting, after the close, or always to the team; a quiz reveals its answer with them. */
export function decidePollVisibility(input: PollVisibilityInput): PollVisibility {
  const { payload, votedIndex, isMember, now } = input;
  const shown = isMember || votedIndex !== null || isPollClosed(payload, now);
  return { results: shown, answer: payload.kind === 'quiz' && shown };
}
