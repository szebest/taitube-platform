import { MS_PER_HOUR, MS_PER_SECOND } from '@kit/primitives';
import type { OutboxStatus } from '@vp/domain';
import { OUTBOX_ROW } from './outbox-row.machine';

/**
 * With the backoff below, about ten hours of failing publishes before a row is given up on.
 * @internal
 */
export const OUTBOX_MAX_ATTEMPTS = 20;

/** How long a relay holds the rows it claimed; longer than one drain, so two relays never share one. */
export const OUTBOX_CLAIM_LEASE_MS = 60 * MS_PER_SECOND;

const MAX_RETRY_DELAY_MS = MS_PER_HOUR;

interface OutboxAttemptOutcome {
  status: OutboxStatus;
  claimableAt: Date;
}

/** Where a failed publish leaves its row: retried after a doubling delay, or dead on the last attempt. */
export function decideOutboxAttempt(attempts: number, now: Date): OutboxAttemptOutcome {
  const edge = attempts >= OUTBOX_MAX_ATTEMPTS ? 'bury' : 'retry';
  const delayMs = Math.min(2 ** attempts * MS_PER_SECOND, MAX_RETRY_DELAY_MS);
  return { status: OUTBOX_ROW.target(edge), claimableAt: new Date(now.getTime() + delayMs) };
}
