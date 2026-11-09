import type {
  CommentModerationAction,
  CommentModerationReason,
  Disclosure,
  ModerationOutcome,
  ModerationState,
} from '@vp/domain';
import { type Result, assertNever, err, ok } from '@vp/result';
import { type ModerationNotApplicable, moderationNotApplicable } from './failures';

const PUBLISHED: ModerationOutcome = {
  state: 'published',
  disclosure: null,
  reason: null,
  note: null,
};

function outcome(
  state: ModerationOutcome['state'],
  action: { disclosure: Disclosure; reason?: CommentModerationReason; note?: string }
): ModerationOutcome {
  return {
    state,
    disclosure: action.disclosure,
    reason: action.reason ?? null,
    note: action.note ?? null,
  };
}

/** The next state of a comment, or the reason the action does not apply to the state it is in. */
export function applyModeration(
  state: ModerationState,
  action: CommentModerationAction
): Result<ModerationOutcome, ModerationNotApplicable> {
  const refuse = (why: 'state' | 'reason_required') =>
    err(moderationNotApplicable(action.action, state, why));
  const needsReason = (given: { disclosure: Disclosure; reason?: CommentModerationReason }) =>
    given.disclosure === 'visible' && given.reason === undefined;

  switch (action.action) {
    case 'hold':
      return state === 'published' ? ok(outcome('held', action)) : refuse('state');
    case 'approve':
      return state === 'held' ? ok(PUBLISHED) : refuse('state');
    case 'hide':
      if (state !== 'published') return refuse('state');
      return needsReason(action) ? refuse('reason_required') : ok(outcome('hidden', action));
    case 'unhide':
      return state === 'hidden' ? ok(PUBLISHED) : refuse('state');
    case 'remove':
      return needsReason(action) ? refuse('reason_required') : ok(outcome('removed', action));
    default:
      return assertNever(action, 'CommentModerationAction');
  }
}
