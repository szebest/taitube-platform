import { percent, table } from './markdown';

export interface CauseRule {
  cause: string;
  /** Matched against a failed job's log; the first rule that matches names the cause. */
  pattern: RegExp;
  /** A cause that is the platform's instability, never the change under test. */
  instability: boolean;
}

export const CAUSES: readonly CauseRule[] = [
  {
    cause: 'budget',
    pattern: /##\[error\]\S+ took \d+ ms, over its \d+ s budget/,
    instability: true,
  },
  { cause: 'missing baseline', pattern: /A snapshot doesn't exist at /, instability: true },
  {
    cause: 'unhandled request',
    pattern: /No MSW handler answered|UnhandledRequestError/,
    instability: true,
  },
  { cause: 'generated file missing', pattern: /ENOENT[^\n]*\/generated\//, instability: true },
  { cause: 'fixture missing', pattern: /ENOENT[^\n]*tests\/fixtures\//, instability: true },
  {
    cause: 'native crash',
    pattern: /Process completed with exit code 13[249]\b/,
    instability: true,
  },
  { cause: 'job timeout', pattern: /has exceeded the maximum execution time/, instability: true },
  {
    cause: 'visual pixel diff',
    pattern: /\d+ pixels \(ratio [\d.]+ of all image pixels\) are different/,
    instability: false,
  },
  {
    cause: 'stale route tree',
    pattern: /diff --git a\/apps\/client\/[^/]+\/src\/routeTree\.gen\.ts/,
    instability: false,
  },
  {
    cause: 'knip',
    pattern: /Unused (files|exports|exported types|dependencies|devDependencies) \(\d+\)/,
    instability: false,
  },
  { cause: 'architecture rule', pattern: /FAIL\s+architecture(-typed)?\s/, instability: false },
  { cause: 'type error', pattern: /error TS\d+:/, instability: false },
  { cause: 'lint', pattern: /Found \d+ errors?\./, instability: false },
  { cause: 'e2e spec', pattern: /^\s+\d+ failed\n\s+\[chromium\] › /m, instability: false },
  {
    cause: 'unit assertion',
    pattern: /AssertionError|expect\(received\)|Test Files\s+\d+ failed/,
    instability: false,
  },
];

export const UNCLASSIFIED = 'unclassified';

// biome-ignore lint/suspicious/noControlCharactersInRegex: a GitHub log colours its lines with ANSI escapes
const ANSI = /\x1b\[[0-9;]*m/g;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z /gm;

export function causeOf(log: string): string {
  const plain = log.replace(ANSI, '').replace(TIMESTAMP, '');
  return CAUSES.find((rule) => rule.pattern.test(plain))?.cause ?? UNCLASSIFIED;
}

export interface CauseCount {
  cause: string;
  jobs: number;
  flipped: number;
}

export function renderCauses(counts: readonly CauseCount[]): string {
  const total = counts.reduce((sum, row) => sum + row.jobs, 0);
  return table(
    ['Cause', 'Jobs', 'Share', 'Flipped', 'Instability'],
    [...counts]
      .sort((a, b) => b.jobs - a.jobs)
      .map((row) => [
        row.cause,
        row.jobs,
        percent(row.jobs, total),
        row.flipped,
        CAUSES.find((rule) => rule.cause === row.cause)?.instability ? 'yes' : 'no',
      ])
  );
}
