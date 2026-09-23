import { fromPromise, isErr } from '@vp/result';

export interface ShutdownPlan {
  drain(): void;
  drainDelayMs: number;
  close(): Promise<unknown>;
  graceMs: number;
  pending(): string | undefined;
  log(message: string): void;
}

export type ShutdownOutcome = 'drained' | 'failed' | 'forced';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function drainThenClose(plan: ShutdownPlan): Promise<ShutdownOutcome> {
  await sleep(plan.drainDelayMs);
  const closed = await fromPromise(
    () => plan.close(),
    (cause) => cause
  );
  if (isErr(closed)) {
    plan.log(
      `shutdown failed: ${closed.error instanceof Error ? closed.error.message : closed.error}`
    );
    return 'failed';
  }
  plan.log('shutdown complete');
  return 'drained';
}

/**
 * Readiness flips first and the server keeps accepting for `drainDelayMs`, so a load balancer
 * stops routing before the listener closes; a close that outlives `graceMs` is abandoned, named.
 */
export function shutdownOnce(plan: ShutdownPlan): () => Promise<ShutdownOutcome> {
  let running: Promise<ShutdownOutcome> | undefined;

  const run = async (): Promise<ShutdownOutcome> => {
    plan.log('shutdown: draining');
    plan.drain();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const forced = new Promise<'forced'>((resolve) => {
      timer = setTimeout(() => resolve('forced'), plan.graceMs);
    });

    const outcome = await Promise.race([drainThenClose(plan), forced]);
    clearTimeout(timer);

    if (outcome === 'forced') {
      plan.log(
        `shutdown forced after ${plan.graceMs} ms, still waiting on ${plan.pending() ?? 'the server close'}`
      );
    }
    return outcome;
  };

  return () => {
    running ??= run();
    return running;
  };
}
