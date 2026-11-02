import type { FirstTimeRow } from './first-time';
import { type Flips, flipRate } from './flips';
import { MARGIN, type MarginRow } from './margins';
import { percent } from './markdown';

const MAIN_GREEN_FIRST_TIME = 0.95;
const MAX_FLIP_RATE = 0.02;
const MAIN = 'main (push)';

export interface Measured {
  firstTime: readonly FirstTimeRow[];
  flips: Flips;
  margins: readonly MarginRow[];
}

/** Each threshold the window breaks, in words; empty when the window is healthy. */
export function breaches({ firstTime, flips, margins }: Measured): string[] {
  const found: string[] = [];
  const main = firstTime.find((row) => row.branch === MAIN);
  if (main && main.conclusive > 0 && main.green / main.conclusive < MAIN_GREEN_FIRST_TIME) {
    found.push(
      `main is green first time on ${percent(main.green, main.conclusive)} of runs, below ${percent(MAIN_GREEN_FIRST_TIME, 1)}`
    );
  }
  if (flipRate(flips) >= MAX_FLIP_RATE) {
    found.push(
      `${percent(flips.flippedCommits, flips.conclusiveCommits)} of commits had a root flip, at or above ${percent(MAX_FLIP_RATE, 1)}`
    );
  }
  for (const row of margins.filter((candidate) => candidate.near85 > 0)) {
    found.push(
      `${row.label}: ${row.near85} of ${row.runs} runs within ${percent(1 - MARGIN, 1)} of its ${row.seconds} s limit, the slowest ${row.max.toFixed(0)} s`
    );
  }
  return found;
}
