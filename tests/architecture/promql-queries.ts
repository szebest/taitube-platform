import { loadAll } from 'js-yaml';
import { read, trackedFiles } from './repo-files';

export interface Query {
  /** Where the query is written, as `file: panel or rule`. */
  where: string;
  expr: string;
}

export interface Matcher {
  metric: string;
  label: string;
  op: '=' | '=~' | '!=' | '!~';
  value: string;
}

function dashboardQueries(file: string): Query[] {
  const found: Query[] = [];
  const walk = (node: unknown, title: string): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, title);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;
    const here = typeof record.title === 'string' ? record.title : title;
    if (typeof record.expr === 'string')
      found.push({ where: `${file}: ${here}`, expr: record.expr });
    for (const value of Object.values(record)) walk(value, here);
  };
  walk(JSON.parse(read(file)), '');
  return found;
}

function alertQueries(file: string): Query[] {
  const [doc] = loadAll(read(file)) as [{ groups: { rules: { alert: string; expr: string }[] }[] }];
  return doc.groups.flatMap(({ rules }) =>
    rules.map(({ alert, expr }) => ({ where: `${file}: ${alert}`, expr }))
  );
}

interface ScaledObject {
  metadata: { name: string };
  spec?: { triggers?: { type: string; metadata: { query?: string } }[] };
}

function scalerQueries(file: string): Query[] {
  return (loadAll(read(file)) as ScaledObject[]).flatMap((doc) =>
    (doc.spec?.triggers ?? [])
      .filter((trigger) => trigger.metadata.query !== undefined)
      .map((trigger) => ({
        where: `${file}: ${doc.metadata.name}`,
        expr: trigger.metadata.query as string,
      }))
  );
}

/** Every PromQL expression a dashboard, an alert or an autoscaler depends on. */
export function repoQueries(): Query[] {
  return trackedFiles('infra/observability/dashboards')
    .filter((file) => file.endsWith('.json'))
    .flatMap(dashboardQueries)
    .concat(trackedFiles('infra/observability/alerts').flatMap(alertQueries))
    .concat(scalerQueries('infra/k8s/base/scaled-objects.yaml'));
}

const SELECTOR = /([a-zA-Z_:][\w:]*)\s*\{([^}]*)\}/g;
const MATCHER = /(\w+)\s*(=~|!~|!=|=)\s*"([^"]*)"/g;

export function matchers(expr: string): Matcher[] {
  return [...expr.matchAll(SELECTOR)].flatMap(([, metric, body]) =>
    [...(body ?? '').matchAll(MATCHER)].map(([, label, op, value]) => ({
      metric: metric as string,
      label: label as string,
      op: op as Matcher['op'],
      value: value as string,
    }))
  );
}

/** The PromQL vocabulary: functions, aggregations and operators, never a metric. */
const PROMQL_WORDS = new Set([
  'sum',
  'avg',
  'min',
  'max',
  'count',
  'topk',
  'bottomk',
  'rate',
  'irate',
  'increase',
  'delta',
  'histogram_quantile',
  'predict_linear',
  'vector',
  'scalar',
  'abs',
  'clamp_min',
  'clamp_max',
  'or',
  'and',
  'unless',
  'offset',
  'bool',
  'time',
  'label_replace',
  'absent',
]);

/** The metric names an expression reads, with label sets, groupings, ranges and strings removed. */
export function metricNames(expr: string): string[] {
  const bare = expr
    .replace(/"[^"]*"/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\b(by|without|on|ignoring|group_left|group_right)\s*\([^)]*\)/g, '')
    .replace(/\$\{?\w+\}?/g, '')
    .replace(/(?<![\w:])\d[\d.]*(e\d+)?/g, '');
  return [...bare.matchAll(/[a-zA-Z_:][\w:]*/g)]
    .map(([name]) => name)
    .filter((name) => !PROMQL_WORDS.has(name));
}
