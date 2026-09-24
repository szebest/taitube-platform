import { loadAll } from 'js-yaml';
import type ts from 'typescript';
import { ANY_VALUE, type LabelValues, emittedLabels, registeredMetrics } from './metric-emissions';
import { fixtureProgram, productionProgram } from './program';
import { type Query, matchers, metricNames, repoQueries } from './promql-queries';
import { read, trackedFiles } from './repo-files';

type Emitted = Map<string, Map<string, LabelValues>>;

function deploymentNames(): Set<string> {
  const docs = trackedFiles('infra/k8s/base')
    .filter((file) => file.endsWith('.yaml'))
    .flatMap((file) => loadAll(read(file)) as { kind?: string; metadata?: { name?: string } }[]);
  return new Set(docs.filter((d) => d?.kind === 'Deployment').map((d) => d.metadata?.name ?? ''));
}

/**
 * Series this repo reads but another process exports, by name prefix, with the labels whose values
 * this repo decides. A metric outside the registry and every entry here is read from nowhere.
 */
const EXPORTERS: Record<string, { by: string; labels: () => Map<string, LabelValues> }> = {
  kube_: { by: 'kube-state-metrics', labels: () => new Map([['deployment', deploymentNames()]]) },
  prometheus_: { by: 'Prometheus itself', labels: () => new Map() },
  scrape_: { by: 'Prometheus scrape metadata', labels: () => new Map() },
  vp_: { by: 'collectDefaultMetrics', labels: () => new Map() },
};

const PLAIN_ALTERNATIVES = /^[\w.:<>-]+(\|[\w.:<>-]+)*$/;

function unmatchedValue(values: LabelValues, op: '=' | '=~', value: string): string | undefined {
  if (values === ANY_VALUE) return undefined;
  if (op === '=') return values.has(value) ? undefined : value;
  if (PLAIN_ALTERNATIVES.test(value)) return value.split('|').find((v) => !values.has(v));
  const pattern = new RegExp(`^(?:${value})$`);
  return [...values].some((v) => pattern.test(v)) ? undefined : value;
}

/** Every label value a query selects on that no code path records, and every metric nobody exports. */
function unemitted(queries: readonly Query[], emitted: Emitted): string[] {
  const series = new Map(
    registeredMetrics().flatMap(({ field, series }) => series.map((name) => [name, field] as const))
  );
  const labelsOf = (metric: string): Map<string, LabelValues> | undefined => {
    const field = series.get(metric);
    if (field) return emitted.get(field) ?? new Map();
    const exporter = Object.entries(EXPORTERS).find(([prefix]) => metric.startsWith(prefix));
    return exporter?.[1].labels();
  };

  return queries.flatMap(({ where, expr }) => [
    ...metricNames(expr)
      .filter((metric) => labelsOf(metric) === undefined)
      .map((metric) => `${where}: ${metric} is exported by nothing`),
    ...matchers(expr).flatMap(({ metric, label, op, value }) => {
      const labels = labelsOf(metric);
      if (!labels || op === '!=' || op === '!~') return [];
      const values = labels.get(label);
      if (!values) return [`${where}: ${metric} never records ${label}`];
      const missing = unmatchedValue(values, op, value);
      return missing === undefined
        ? []
        : [`${where}: ${metric}{${label}="${missing}"} is never emitted`];
    }),
  ]);
}

const FIXTURE_SOURCE = [
  'declare const metrics: { jobsProcessed: { inc(labels: object): void } };',
  'declare const queue: string;',
  'declare const ok: boolean;',
  "metrics.jobsProcessed.inc({ queue, result: ok ? 'completed' : 'failed' });",
].join('\n');

function fixtureEmitted(): Emitted {
  const program = fixtureProgram({ '/fixture/stage.ts': FIXTURE_SOURCE });
  const file = program.getSourceFile('/fixture/stage.ts') as ts.SourceFile;
  return emittedLabels(program, [file], new Set(['jobsProcessed']));
}

describe('architecture: every label value a query needs is emitted', () => {
  it('reads a literal union as the values a call can record, and a string as any value', () => {
    const labels = fixtureEmitted().get('jobsProcessed');

    expect(labels?.get('result')).toEqual(new Set(['completed', 'failed']));
    expect(labels?.get('queue')).toBe(ANY_VALUE);
  });

  it.each([
    ['a value no call records', 'sum(jobs_processed_total{result="stalled"})', 'is never emitted'],
    ['a regex alternative no call records', 'jobs_processed_total{result=~"failed|dlq"}', 'dlq'],
    ['a label no call records', 'jobs_processed_total{state="active"}', 'never records state'],
    [
      'a metric nobody exports',
      'sum(neon_compute_hours_used) or vector(12.5)',
      'exported by nothing',
    ],
  ])('fires on %s', (_name, expr, finding) => {
    expect(unemitted([{ where: 'fixture', expr }], fixtureEmitted())).toEqual([
      expect.stringContaining(finding),
    ]);
  });

  it('passes a query every value of which is recorded', () => {
    const expr = 'sum(rate(jobs_processed_total{result=~"completed|failed", queue="probe"}[5m]))';

    expect(unemitted([{ where: 'fixture', expr }], fixtureEmitted())).toEqual([]);
  });

  it('finds every dashboard, alert and autoscaler query answered by code that runs', () => {
    const { program, roots } = productionProgram();
    const files = program.getSourceFiles().filter((file) => roots.has(file.fileName));
    const fields = new Set(registeredMetrics().map(({ field }) => field));
    const queries = repoQueries();

    expect(queries.length).toBeGreaterThan(40);
    expect(unemitted(queries, emittedLabels(program, files, fields))).toEqual([]);
  });
});
