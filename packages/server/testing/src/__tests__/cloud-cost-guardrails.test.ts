import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

interface AlertRules {
  groups: { rules: { alert: string; annotations: { runbook_url?: string } }[] }[];
}

const repoRoot = path.resolve(__dirname, '../../../../../');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf-8');

const alerts = (
  yaml.load(read('infra/observability/alerts/video-pipeline-alerts.yaml')) as AlertRules
).groups.flatMap((group) => group.rules);

describe('cloud cost guardrails, alert rules and operator runbooks', () => {
  it('defines the R2ClassABudget alert with its runbook', () => {
    const budget = alerts.find((rule) => rule.alert === 'R2ClassABudget');

    expect(budget?.annotations.runbook_url).toBe('docs/runbooks/cost-budget.md');
  });

  it('covers Class A/B ops and Grafana Cloud series on the Storage & Cost dashboard', () => {
    const dashboard: { title: string; panels: { title?: string }[] } = JSON.parse(
      read('infra/observability/dashboards/storage-cost.json')
    );
    const panelTitles = dashboard.panels.map((panel) => panel.title);

    expect(dashboard.title).toBe('Storage & Cost');
    expect(panelTitles).toEqual(
      expect.arrayContaining([
        'Class A & Class B Storage Ops per Hour',
        'Projected Monthly Class A Ops (R2 1M/mo Free Tier Budget)',
        'Grafana Cloud Active Metric Series Count (10k Free Tier Budget)',
      ])
    );
  });

  it.each([
    'dlq-replay.md',
    'queue-paused.md',
    'worker-stuck.md',
    'storage-outage.md',
    'cost-budget.md',
  ])('has the operator runbook %s with the required six-part structure', (runbook) => {
    const content = read(`docs/runbooks/${runbook}`);

    expect(content).toMatch(/## 2\.\s+Trigger/i);
    expect(content).toMatch(/## 3\.\s+Dashboards to Open/i);
    expect(content).toMatch(/## 4\.\s+Diagnosis/i);
    expect(content).toMatch(/## 5\.\s+Remediation/i);
    expect(content).toMatch(/## 6\.\s+Verification/i);
    expect(content).toMatch(/## 7\.\s+Prevention/i);
  });

  it('resolves every runbook_url in the alert rules to a file in docs/runbooks/', () => {
    const runbooks = alerts.map((rule) => rule.annotations.runbook_url ?? '');

    expect(runbooks.length).toBeGreaterThanOrEqual(10);
    for (const runbook of runbooks) {
      expect(runbook.startsWith('docs/runbooks/')).toBe(true);
      expect(existsSync(path.join(repoRoot, runbook)), `${runbook} must exist`).toBe(true);
    }
  });
});
