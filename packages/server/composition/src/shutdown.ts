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
  if (plan.drainDelayMs > 0) await sleep(plan.drainDelayMs);
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

/** What a deployable takes from the process it runs in, so a spec can stand in for that process. */
export interface ProcessHost {
  env: Record<string, string | undefined>;
  onSignal: (signal: 'SIGTERM' | 'SIGINT', handler: () => void) => void;
  exit: (code: number) => void;
}

/**
 * Installed before the first start, so a `SIGTERM` while the process boots runs the same drained
 * shutdown as one that arrives later, instead of killing it.
 */
export function exitOnSignals(host: ProcessHost, shutdown: () => Promise<ShutdownOutcome>): void {
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    host.onSignal(signal, () => {
      void shutdown().then((outcome) => host.exit(outcome === 'drained' ? 0 : 1));
    });
  }
}
