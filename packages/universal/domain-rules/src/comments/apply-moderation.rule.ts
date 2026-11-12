import type {
  CommentModerationAction,
  CommentModerationReason,
  Disclosure,
  ModerationOutcome,
  ModerationState,
} from '@vp/domain';
import { type Result, assertNever, err, ok } from '@vp/result';
import { COMMENT_MODERATION } from './comment-moderation.machine';
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

  const next = COMMENT_MODERATION.next(state, action.action);
  if (next === undefined) return refuse('state');

  switch (action.action) {
    case 'hold':
      return ok(outcome(next, action));
    case 'approve':
    case 'unhide':
      return ok(PUBLISHED);
    case 'hide':
    case 'remove':
      return needsReason(action) ? refuse('reason_required') : ok(outcome(next, action));
    default:
      return assertNever(action, 'CommentModerationAction');
  }
}
