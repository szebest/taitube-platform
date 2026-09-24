import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ParsedRule {
  alert: string;
  expr: string;
  forDuration: string;
  severity: string;
  summary?: string;
  description?: string;
  runbookUrl?: string;
  environment?: string;
}

export const rootDir = path.resolve(__dirname, '../../../../../');
export const alertRulesPath = path.resolve(
  rootDir,
  'infra/observability/alerts/video-pipeline-alerts.yaml'
);
export const alertmanagerPath = path.resolve(rootDir, 'infra/compose/alertmanager/alertmanager.yml');

const QUOTED = `["']?([^"']+)["']?`;
const FIELDS: [RegExp, keyof ParsedRule][] = [
  [/^\s*for:\s*([0-9]+[smhd])/, 'forDuration'],
  [/^\s*severity:\s*([a-z]+)/, 'severity'],
  [/^\s*environment:\s*([A-Za-z0-9_-]+)/, 'environment'],
  [new RegExp(`^\\s*runbook_url:\\s*${QUOTED}`), 'runbookUrl'],
  [new RegExp(`^\\s*summary:\\s*${QUOTED}`), 'summary'],
  [new RegExp(`^\\s*description:\\s*${QUOTED}`), 'description'],
];

/** A line parser for the alert rules file, so the spec needs no YAML dependency. */
export function parsePrometheusRules(yamlContent: string): ParsedRule[] {
  const rules: ParsedRule[] = [];
  let currentRule: Partial<ParsedRule> | null = null;
  let inExprBlock = false;
  let exprLines: string[] = [];

  const flushExpr = () => {
    if (currentRule && exprLines.length > 0) {
      currentRule.expr = exprLines.join(' ').trim();
      exprLines = [];
    }
    inExprBlock = false;
  };

  for (const rawLine of yamlContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || (trimmed.startsWith('#') && !inExprBlock)) continue;

    const alertMatch = rawLine.match(/^\s*-\s*alert:\s*([A-Za-z0-9_]+)/);
    if (alertMatch) {
      flushExpr();
      if (currentRule?.alert) rules.push(currentRule as ParsedRule);
      currentRule = { alert: alertMatch[1] };
      continue;
    }

    if (!currentRule) continue;

    if (trimmed === 'expr: |') {
      inExprBlock = true;
      exprLines = [];
      continue;
    }

    const singleExprMatch = rawLine.match(/^\s*expr:\s*(.+)$/);
    if (singleExprMatch && !inExprBlock) {
      currentRule.expr = singleExprMatch[1]?.trim();
      continue;
    }

    const field = FIELDS.find(([pattern]) => pattern.test(rawLine));
    if (field) {
      flushExpr();
      currentRule[field[1]] = rawLine.match(field[0])?.[1]?.trim();
      continue;
    }

    if (inExprBlock) {
      if (rawLine.startsWith('        ')) {
        exprLines.push(trimmed);
      } else {
        flushExpr();
      }
    }
  }

  flushExpr();
  if (currentRule?.alert) rules.push(currentRule as ParsedRule);

  return rules;
}

export function loadAlertRules(): ParsedRule[] {
  return parsePrometheusRules(fs.readFileSync(alertRulesPath, 'utf-8'));
}
