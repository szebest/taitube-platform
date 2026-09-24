import { loadAll } from 'js-yaml';
import type ts from 'typescript';
import { ANY_VALUE, type LabelValues, emittedLabels, registeredMetrics } from './metric-emissions';
import { fixtureProgram, serverProgram } from './program';
import { type Query, parseQuery, repoQueries } from './promql-queries';
import { read, trackedFiles } from './repo-files';

type Emitted = Map<string, Map<string, LabelValues>>;

interface KubernetesObject {
  kind?: string;
  metadata?: { name?: string };
}

function deploymentNames(): Set<string> {
  const manifests = trackedFiles('infra/k8s/base').filter((file) => file.endsWith('.yaml'));
  const objects = manifests.flatMap((file) => loadAll(read(file)) as KubernetesObject[]);
  const names = new Set<string>();
  for (const object of objects) {
    if (object?.kind === 'Deployment' && object.metadata?.name) names.add(object.metadata.name);
  }
  return names;
}

interface Exporter {
  prefix: string;
  by: string;
  /** The labels whose values this repo decides, such as the Deployment names it ships. */
  labels: ReadonlyMap<string, LabelValues>;
}

/** Series this repo reads that another process exports. A metric outside these and the registry is read from nowhere. */
const EXPORTERS: readonly Exporter[] = [
  {
    prefix: 'kube_',
    by: 'kube-state-metrics',
    labels: new Map([['deployment', deploymentNames()]]),
  },
  { prefix: 'prometheus_', by: 'Prometheus itself', labels: new Map() },
  { prefix: 'scrape_', by: 'Prometheus scrape metadata', labels: new Map() },
  { prefix: 'vp_', by: 'collectDefaultMetrics', labels: new Map() },
];

/** Each `|` alternative is a pattern that some recorded value has to match. */
function unmatchedAlternative(values: LabelValues, value: string): string | undefined {
  if (values === ANY_VALUE) return undefined;
  const recorded = [...values];
  return value.split('|').find((alternative) => {
    const pattern = new RegExp(`^(?:${alternative})$`);
    return !recorded.some((candidate) => pattern.test(candidate));
  });
}

interface Source {
  labels: ReadonlyMap<string, LabelValues>;
  /** Whether a label missing from `labels` is a finding: only for the registry's own metrics. */
  ownsEveryLabel: boolean;
}

function sourceOf(metric: string, emitted: Emitted): Source | undefined {
  const registered = registeredMetrics().find(({ series }) => series.includes(metric));
  if (registered) {
    return { labels: emitted.get(registered.field) ?? new Map(), ownsEveryLabel: true };
  }
  const exporter = EXPORTERS.find(({ prefix }) => metric.startsWith(prefix));
  if (exporter) return { labels: exporter.labels, ownsEveryLabel: false };
  return undefined;
}

function unemitted(queries: readonly Query[], emitted: Emitted): string[] {
  const findings: string[] = [];
  for (const { where, expr } of queries) {
    const parsed = parseQuery(expr);
    if (!parsed.parses) findings.push(`${where}: does not parse as PromQL`);

    for (const { metric, matchers } of parsed.selectors) {
      if (metric === '') continue;
      const source = sourceOf(metric, emitted);
      if (!source) {
        findings.push(`${where}: ${metric} is exported by nothing`);
        continue;
      }
      for (const { label, op, value } of matchers) {
        if (op === '!=' || op === '!~') continue;
        const values = source.labels.get(label);
        if (!values) {
          if (source.ownsEveryLabel) findings.push(`${where}: ${metric} never records ${label}`);
          continue;
        }
        const missing = unmatchedAlternative(values, value);
        if (missing !== undefined) {
          findings.push(`${where}: ${metric}{${label}="${missing}"} is never emitted`);
        }
      }
    }
  }
  return findings;
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
    ['a query that is not PromQL', 'sum(jobs_processed_total{result="failed"}', 'does not parse'],
  ])('fires on %s', (_name, expr, finding) => {
    expect(unemitted([{ where: 'fixture', expr }], fixtureEmitted())).toEqual([
      expect.stringContaining(finding),
    ]);
  });

  it('passes a query every value of which is recorded', () => {
    const expr = 'sum(rate(jobs_processed_total{result=~"completed|fail.*", queue="probe"}[5m]))';

    expect(unemitted([{ where: 'fixture', expr }], fixtureEmitted())).toEqual([]);
  });

  it('finds every dashboard, alert and autoscaler query answered by code that runs', () => {
    const { program, roots } = serverProgram();
    const files = program.getSourceFiles().filter((file) => roots.has(file.fileName));
    const fields = new Set(registeredMetrics().map(({ field }) => field));
    const queries = repoQueries();

    expect(queries.length).toBeGreaterThan(40);
    expect(unemitted(queries, emittedLabels(program, files, fields))).toEqual([]);
  });
});
