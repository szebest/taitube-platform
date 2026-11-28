import { parser } from '@prometheus-io/lezer-promql';
import { load } from 'js-yaml';
import { read } from './repo-files';

interface Rule {
  alert: string;
  expr: string;
  for: string;
  labels: { severity: string };
  annotations: { runbook_url: string };
}

const RULES = (
  load(read('infra/observability/alerts/video-pipeline-alerts.yaml')) as {
    groups: { rules: Rule[] }[];
  }
).groups.flatMap((group) => group.rules);

const ruleOf = (alert: string) => {
  const rule = RULES.find((candidate) => candidate.alert === alert);
  if (!rule) throw new Error(`no ${alert} rule`);
  return rule;
};

/** The number the rule's comparison reads, taken from the parsed expression and not from its text. */
function thresholdOf({ expr }: Rule): number {
  const numbers: number[] = [];
  parser.parse(expr).iterate({
    enter: (ref) => {
      if (ref.name === 'NumberDurationLiteral' || ref.name === 'NumberLiteral') {
        numbers.push(Number(expr.slice(ref.from, ref.to)));
      }
    },
  });
  const last = numbers.at(-1);
  if (last === undefined) throw new Error(`${expr} compares against no number`);
  return last;
}

/** Prometheus' `histogram_quantile` over cumulative `le` buckets, interpolating inside the bucket. */
function quantile(q: number, buckets: readonly (readonly [le: number, count: number])[]): number {
  const total = buckets.at(-1)?.[1] ?? 0;
  const rank = q * total;
  const index = buckets.findIndex(([, count]) => count >= rank);
  const [le = 0, count = 0] = buckets[index] ?? [];
  const [lower = 0, below = 0] = index > 0 ? (buckets[index - 1] ?? []) : [];
  return lower + ((le - lower) * (rank - below)) / (count - below);
}

const INF = Number.POSITIVE_INFINITY;

/** What the rule's left-hand side evaluates to on a synthetic series, as one number per scenario. */
const SERIES = {
  WatchPartyDriftHigh: {
    normal: quantile(0.95, [
      [0.5, 100],
      [2, 100],
      [INF, 100],
    ]),
    degraded: quantile(0.95, [
      [0.5, 0],
      [2, 100],
      [INF, 100],
    ]),
  },
  WatchPartyFanoutSlow: {
    normal: quantile(0.95, [
      [0.1, 100],
      [0.5, 100],
      [INF, 100],
    ]),
    degraded: quantile(0.95, [
      [0.1, 0],
      [0.5, 100],
      [INF, 100],
    ]),
  },
  WatchPartyPasswordBruteForce: { normal: 0.5, degraded: 3 },
  WatchPartyGuestFlood: { normal: 5, degraded: 15 },
  WatchPartyClockSkew: { normal: Math.abs(0.01), degraded: Math.abs(-0.25) },
} as const;

describe('infra/observability: the watch party alerts', () => {
  it.each(Object.entries(SERIES).map(([alert, series]) => ({ alert, ...series })))(
    '$alert stays quiet on a healthy series and fires on a degraded one',
    ({ alert, normal, degraded }) => {
      const threshold = thresholdOf(ruleOf(alert));

      expect(normal > threshold).toBe(false);
      expect(degraded > threshold).toBe(true);
    }
  );

  it.each(Object.keys(SERIES).map((alert) => ({ alert })))(
    '$alert is a warning with a runbook of its own',
    ({ alert }) => {
      const rule = ruleOf(alert);

      expect(rule.labels.severity).toBe('warning');
      expect(rule.annotations.runbook_url).toMatch(/^docs\/runbooks\/watch-party-[a-z-]+\.md$/);
    }
  );

  it('names exactly the five alerts section 17 asks for', () => {
    expect(
      RULES.map(({ alert }) => alert).filter((alert) => alert.startsWith('WatchParty'))
    ).toEqual(Object.keys(SERIES));
  });
});
