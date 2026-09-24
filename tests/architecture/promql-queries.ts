import type { SyntaxNode } from '@lezer/common';
import { parser } from '@prometheus-io/lezer-promql';
import { loadAll } from 'js-yaml';
import { read, trackedFiles } from './repo-files';

export interface Query {
  where: string;
  expr: string;
}

export type MatchOperator = '=' | '!=' | '=~' | '!~';

export interface Matcher {
  label: string;
  op: MatchOperator;
  value: string;
}

export interface Selector {
  /** Empty for a selector that names no metric, such as `{job="api"}`. */
  metric: string;
  matchers: Matcher[];
}

export interface ParsedQuery {
  parses: boolean;
  selectors: Selector[];
}

interface Dashboard {
  panels: { title?: string; targets?: { expr?: string }[] }[];
}

interface AlertRules {
  groups: { rules: { alert: string; expr: string }[] }[];
}

interface ScaledObject {
  metadata: { name: string };
  spec?: { triggers?: { metadata: { query?: string } }[] };
}

function dashboardQueries(file: string): Query[] {
  const dashboard: Dashboard = JSON.parse(read(file));
  const queries: Query[] = [];
  for (const panel of dashboard.panels) {
    for (const target of panel.targets ?? []) {
      if (target.expr) queries.push({ where: `${file}: ${panel.title}`, expr: target.expr });
    }
  }
  return queries;
}

function alertQueries(file: string): Query[] {
  const documents = loadAll(read(file)) as AlertRules[];
  const queries: Query[] = [];
  for (const document of documents) {
    for (const group of document.groups) {
      for (const rule of group.rules) {
        queries.push({ where: `${file}: ${rule.alert}`, expr: rule.expr });
      }
    }
  }
  return queries;
}

function scalerQueries(file: string): Query[] {
  const scaledObjects = loadAll(read(file)) as ScaledObject[];
  const queries: Query[] = [];
  for (const scaledObject of scaledObjects) {
    for (const trigger of scaledObject.spec?.triggers ?? []) {
      const { query } = trigger.metadata;
      if (query) queries.push({ where: `${file}: ${scaledObject.metadata.name}`, expr: query });
    }
  }
  return queries;
}

export function repoQueries(): Query[] {
  const dashboards = trackedFiles('infra/observability/dashboards').filter((file) =>
    file.endsWith('.json')
  );
  const alerts = trackedFiles('infra/observability/alerts');
  return [
    ...dashboards.flatMap(dashboardQueries),
    ...alerts.flatMap(alertQueries),
    ...scalerQueries('infra/k8s/base/scaled-objects.yaml'),
  ];
}

/** `$__rate_interval` and `${queue}` are Grafana's, not PromQL, and do not parse. */
const GRAFANA_VARIABLE = /\$\{?\w+\}?/g;

const OPERATORS: Record<string, MatchOperator> = {
  EqlSingle: '=',
  Neq: '!=',
  EqlRegex: '=~',
  NeqRegex: '!~',
};

function unquote(literal: string): string {
  if (literal.startsWith('"')) return JSON.parse(literal);
  return literal.slice(1, -1);
}

function matcherOf(node: SyntaxNode, expr: string): Matcher {
  const matcher: Matcher = { label: '', op: '=', value: '' };
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const text = expr.slice(child.from, child.to);
    const op = OPERATORS[child.name];
    if (child.name === 'LabelName') matcher.label = text;
    if (child.name === 'StringLiteral') matcher.value = unquote(text);
    if (op) matcher.op = op;
  }
  return matcher;
}

export function parseQuery(expr: string): ParsedQuery {
  const promql = expr.replace(GRAFANA_VARIABLE, '5m');
  const parsed: ParsedQuery = { parses: true, selectors: [] };

  parser.parse(promql).iterate({
    enter: (ref) => {
      if (ref.type.isError) parsed.parses = false;
      if (ref.name !== 'VectorSelector') return;

      const metric = ref.node.getChild('Identifier');
      const matcherList = ref.node.getChild('LabelMatchers');
      const matchers = matcherList?.getChildren('UnquotedLabelMatcher') ?? [];
      parsed.selectors.push({
        metric: metric ? promql.slice(metric.from, metric.to) : '',
        matchers: matchers.map((matcher) => matcherOf(matcher, promql)),
      });
    },
  });

  return parsed;
}
