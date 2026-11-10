import type { BulkActionBody } from '@vp/api-contracts';
import { banExpiry, type Disclosure } from '@vp/domain';
import type {
  ModerationReason,
  ReasonedAction,
} from '#app/features/comments/components/moderation-reason-dialog/moderation-reason-dialog';

/**
 * The action a reason dialog asked for. A hide or remove carries the disclosure it was chosen under; a ban
 * is visible by definition, says the note or else the reason, and ends `duration` from `now`.
 */
export function reasonedAction(
  action: ReasonedAction,
  { reason, note, duration }: ModerationReason,
  disclosure: Disclosure,
  reasonLabel: string,
  now: Date = new Date()
): BulkActionBody {
  return action === 'ban'
    ? { action, reason: note ?? reasonLabel, expiresAt: banExpiry(duration, now) }
    : { action, disclosure, reason, note };
}
