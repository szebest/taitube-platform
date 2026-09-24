import * as fs from 'node:fs';
import * as path from 'node:path';
import { alertRulesPath, loadAlertRules, rootDir } from './prometheus-rules';

describe('Prometheus alert rules (SDD §13.5)', () => {
  it('verifies alert rules file exists and contains valid syntax', () => {
    expect(fs.existsSync(alertRulesPath), `Alert rules file missing: ${alertRulesPath}`).toBe(true);
    const content = fs.readFileSync(alertRulesPath, 'utf-8');
    expect(content).toContain('groups:');
    expect(content).toContain('name: video_pipeline_alerts');
  });

  it('defines all 10 alerts specified in SDD §13.5', () => {
    const rules = loadAlertRules();

    expect(rules.map((r) => r.alert)).toEqual([
      'DLQNotEmpty',
      'QueueStarvation',
      'JobFailureRateHigh',
      'SystemicFailure',
      'WorkerStalledJobs',
      'WorkerStuck',
      'ScaleToZeroBroken',
      'R2ClassABudget',
      'APILatencyHigh',
      'WorkerTmpDiskHigh',
    ]);
    expect(rules.length).toBe(10);
  });

  it('verifies every alert carries a valid runbook_url annotation pointing to an existing runbook', () => {
    for (const rule of loadAlertRules()) {
      expect(
        rule.runbookUrl,
        `Alert "${rule.alert}" must have runbook_url annotation`
      ).toBeDefined();
      expect(
        rule.runbookUrl?.startsWith('docs/runbooks/'),
        `Alert "${rule.alert}" runbook_url must point to docs/runbooks/*.md (got ${rule.runbookUrl})`
      ).toBe(true);

      const targetPath = path.resolve(rootDir, rule.runbookUrl ?? '');
      expect(
        fs.existsSync(targetPath),
        `Runbook file for alert "${rule.alert}" does not exist at ${targetPath}`
      ).toBe(true);
    }
  });

  it('verifies each alert has proper severity, duration, and non-empty expression', () => {
    for (const rule of loadAlertRules()) {
      expect(
        ['critical', 'warning', 'info'],
        `Alert "${rule.alert}" has invalid severity ${rule.severity}`
      ).toContain(rule.severity);

      expect(rule.forDuration, `Alert "${rule.alert}" must specify for duration`).toMatch(
        /^[0-9]+[smhd]$/
      );
      expect(rule.expr?.length, `Alert "${rule.alert}" expression cannot be empty`).toBeGreaterThan(
        0
      );
    }
  });

  it('marks ScaleToZeroBroken as Kubernetes-only', () => {
    const scaleAlert = loadAlertRules().find((r) => r.alert === 'ScaleToZeroBroken');

    expect(scaleAlert).toBeDefined();
    expect(scaleAlert?.environment).toBe('kubernetes-only');
    expect(scaleAlert?.expr).toContain('kube_deployment_status_replicas');
  });
});
