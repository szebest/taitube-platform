import type { StepRepository } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr } from '@vp/result';

/**
 * Why an encode was stopped before FFmpeg finished: the lease renewal failed (retry the job) or
 * another worker holds the step now (a zombie commits nothing and steps aside).
 */
type LostLease =
  | { readonly type: 'unavailable'; readonly failure: DatabaseUnavailable }
  | { readonly type: 'fenced' };

export interface StepLease {
  readonly signal: AbortSignal;
  readonly lost: LostLease | undefined;
  renew(force?: boolean): void;
  settled(): Promise<void>;
}

/** Keeps a claimed step's heartbeat alive while FFmpeg runs and aborts the encode if it is lost. */
export function stepLease(steps: Pick<StepRepository, 'heartbeat'>, lockToken: string): StepLease {
  const controller = new AbortController();
  let lost: LostLease | undefined;
  let lastRenewal = 0;
  let pending: Promise<void> = Promise.resolve();

  const heartbeat = async (): Promise<void> => {
    const renewed = await steps.heartbeat(lockToken);
    if (isErr(renewed)) lost = { type: 'unavailable', failure: renewed.error };
    else if (!renewed.value) lost = { type: 'fenced' };
    if (lost) controller.abort();
  };

  return {
    signal: controller.signal,
    get lost() {
      return lost;
    },
    renew(force = false) {
      const now = Date.now();
      if (!force && now - lastRenewal < 2000) return;
      lastRenewal = now;
      pending = heartbeat();
    },
    settled: () => pending,
  };
}
