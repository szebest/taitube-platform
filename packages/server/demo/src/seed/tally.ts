import { type SeedFailure, describeFailure, isUnsupported } from './failure';
import type { StepOutcome } from './scenario';

export interface Tally {
  created(count?: number): void;
  existing(count?: number): void;
  /** A step the host cannot take (no route, no worker): counted apart from a failure. */
  skipped(reason: string): void;
  fail(failure: SeedFailure): void;
  outcome(noun: string): StepOutcome;
}

/** What a scenario did, item by item: a route that is not in this build is a skip, any other failure fails the step. */
export function createTally(): Tally {
  let made = 0;
  let found = 0;
  const failures: string[] = [];
  const skips = new Set<string>();

  return {
    created: (count = 1) => {
      made += count;
    },
    existing: (count = 1) => {
      found += count;
    },
    skipped: (reason) => {
      skips.add(reason);
    },
    fail: (failure) => {
      if (isUnsupported(failure) && failure.kind === 'http') {
        skips.add(`needs ${failure.method} ${failure.path} (not in this build)`);
      } else failures.push(describeFailure(failure));
    },
    outcome: (noun) => {
      const counts = `${made} ${noun} created, ${found} already there`;
      if (failures.length > 0) {
        const more = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
        return { status: 'failed', detail: `${counts}; ${failures[0]}${more}` };
      }
      if (skips.size > 0 && made + found === 0) {
        return { status: 'skipped', detail: [...skips].join('; ') };
      }
      return {
        status: 'done',
        detail: skips.size > 0 ? `${counts}; ${[...skips].join('; ')}` : counts,
      };
    },
  };
}
