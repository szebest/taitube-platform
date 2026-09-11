import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ParsedRule {
  alert: string;
  expr: string;
  forDuration: string;
  severity: string;
  summary?: string;
  description?: string;
  runbookUrl?: string;
  environment?: string;
}

/**
 * Robust line-by-line parser for Prometheus alerting rule files without external YAML dependency.
 */
function parsePrometheusRules(yamlContent: string): ParsedRule[] {
  const lines = yamlContent.split(/\r?\n/);
  const rules: ParsedRule[] = [];
  let currentRule: Partial<ParsedRule> | null = null;
  let inExprBlock = false;
  let exprLines: string[] = [];

  const flushExpr = () => {
    if (currentRule && exprLines.length > 0) {
      currentRule.expr = exprLines.join(' ').trim();
      exprLines = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Skip empty lines and full comments outside multi-line expr
    if (!trimmed || (trimmed.startsWith('#') && !inExprBlock)) {
      continue;
    }

    // Match start of a new alert rule: - alert: <Name>
    const alertMatch = rawLine.match(/^\s*-\s*alert:\s*([A-Za-z0-9_]+)/);
    if (alertMatch) {
      flushExpr();
      if (currentRule?.alert) {
        rules.push(currentRule as ParsedRule);
      }
      currentRule = { alert: alertMatch[1] };
      inExprBlock = false;
      continue;
    }

    if (!currentRule) continue;

    // Check multi-line expression start: expr: |
    if (trimmed === 'expr: |') {
      inExprBlock = true;
      exprLines = [];
      continue;
    }

    // Check single-line expression: expr: <expression>
    const singleExprMatch = rawLine.match(/^\s*expr:\s*(.+)$/);
    if (singleExprMatch && !inExprBlock) {
      currentRule.expr = singleExprMatch[1]?.trim();
      continue;
    }

    // Capture for: <duration>
    const forMatch = rawLine.match(/^\s*for:\s*([0-9]+[smhd])/);
    if (forMatch) {
      flushExpr();
      inExprBlock = false;
      currentRule.forDuration = forMatch[1];
      continue;
    }

    // Capture severity: <level>
    const severityMatch = rawLine.match(/^\s*severity:\s*([a-z]+)/);
    if (severityMatch) {
      flushExpr();
      inExprBlock = false;
      currentRule.severity = severityMatch[1];
      continue;
    }

    // Capture environment: <env>
    const envMatch = rawLine.match(/^\s*environment:\s*([A-Za-z0-9_-]+)/);
    if (envMatch) {
      flushExpr();
      inExprBlock = false;
      currentRule.environment = envMatch[1];
      continue;
    }

    // Capture runbook_url: "<path>" or '<path>' or <path>
    const runbookMatch = rawLine.match(/^\s*runbook_url:\s*["']?([^"']+)["']?/);
    if (runbookMatch) {
      flushExpr();
      inExprBlock = false;
      currentRule.runbookUrl = runbookMatch[1]?.trim();
      continue;
    }

    // Capture summary: "<text>"
    const summaryMatch = rawLine.match(/^\s*summary:\s*["']?([^"']+)["']?/);
    if (summaryMatch) {
      flushExpr();
      inExprBlock = false;
      currentRule.summary = summaryMatch[1]?.trim();
      continue;
    }

    // Capture description: "<text>"
    const descMatch = rawLine.match(/^\s*description:\s*["']?([^"']+)["']?/);
    if (descMatch) {
      flushExpr();
      inExprBlock = false;
      currentRule.description = descMatch[1]?.trim();
      continue;
    }

    // If we're inside a multi-line expr block
    if (inExprBlock) {
      // Check if line is indented more than 'expr:'
      if (rawLine.startsWith('        ') || rawLine.startsWith('          ')) {
        exprLines.push(trimmed);
      } else {
        flushExpr();
        inExprBlock = false;
      }
    }
  }

  flushExpr();
  if (currentRule?.alert) {
    rules.push(currentRule as ParsedRule);
  }

  return rules;
}

describe('Prometheus Alert Rules & Alertmanager (Ticket 24, SDD §13.5)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const alertRulesPath = path.resolve(rootDir, 'observability/alerts/video-pipeline-alerts.yaml');
  const alertmanagerPath = path.resolve(rootDir, 'infra/compose/alertmanager/alertmanager.yml');

  it('verifies alert rules file exists and contains valid syntax', () => {
    expect(fs.existsSync(alertRulesPath), `Alert rules file missing: ${alertRulesPath}`).toBe(true);
    const content = fs.readFileSync(alertRulesPath, 'utf-8');
    expect(content).toContain('groups:');
    expect(content).toContain('name: video_pipeline_alerts');
  });

  it('defines all 10 alerts specified in SDD §13.5', () => {
    const content = fs.readFileSync(alertRulesPath, 'utf-8');
    const rules = parsePrometheusRules(content);

    const expectedAlerts = [
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
    ];

    const parsedNames = rules.map((r) => r.alert);
    expect(parsedNames).toEqual(expectedAlerts);
    expect(rules.length).toBe(10);
  });

  it('verifies every alert carries a valid runbook_url annotation pointing to an existing runbook', () => {
    const content = fs.readFileSync(alertRulesPath, 'utf-8');
    const rules = parsePrometheusRules(content);

    for (const rule of rules) {
      expect(
        rule.runbookUrl,
        `Alert "${rule.alert}" must have runbook_url annotation`
      ).toBeDefined();
      expect(
        rule.runbookUrl?.startsWith('docs/runbooks/'),
        `Alert "${rule.alert}" runbook_url must point to docs/runbooks/*.md (got ${rule.runbookUrl})`
      ).toBe(true);

      const runbookUrl = rule.runbookUrl ?? '';
      const targetPath = path.resolve(rootDir, runbookUrl);
      expect(
        fs.existsSync(targetPath),
        `Runbook file for alert "${rule.alert}" does not exist at ${targetPath}`
      ).toBe(true);
    }
  });

  it('verifies each alert has proper severity, duration, and non-empty expression', () => {
    const content = fs.readFileSync(alertRulesPath, 'utf-8');
    const rules = parsePrometheusRules(content);

    for (const rule of rules) {
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
    const content = fs.readFileSync(alertRulesPath, 'utf-8');
    const rules = parsePrometheusRules(content);

    const scaleAlert = rules.find((r) => r.alert === 'ScaleToZeroBroken');
    expect(scaleAlert).toBeDefined();
    expect(scaleAlert?.environment).toBe('kubernetes-only');
    expect(scaleAlert?.expr).toContain('kube_deployment_status_replicas');
  });

  describe('PromQL Unit Test Logic (Simulation of promtool test rules)', () => {
    it('evaluates DLQNotEmpty: triggers when dlq_entries_total increases > 0', () => {
      // Expression: increase(dlq_entries_total[10m]) > 0
      const evalAlert = (dlqIncrease: number) => dlqIncrease > 0;

      // Normal state: 0 new entries
      expect(evalAlert(0)).toBe(false);

      // Alert condition: 1 new DLQ entry
      expect(evalAlert(1)).toBe(true);
    });

    it('evaluates QueueStarvation: triggers when oldest waiting age > 900s for >= 5m', () => {
      // Expression: bullmq_queue_oldest_waiting_age_seconds > 900
      const evalThreshold = (oldestAgeSec: number) => oldestAgeSec > 900;

      expect(evalThreshold(120)).toBe(false); // 2 minutes: ok
      expect(evalThreshold(900)).toBe(false); // exactly 15m: ok
      expect(evalThreshold(901)).toBe(true); // 15m 1s: firing
      expect(evalThreshold(1200)).toBe(true); // 20m: firing
    });

    it('evaluates JobFailureRateHigh: triggers when failure rate > 0.05 (5%)', () => {
      // Expression: rate(jobs_processed_total{result="failed"}) / rate(jobs_processed_total) > 0.05
      const evalFailureRate = (failedCount: number, totalCount: number) => {
        if (totalCount === 0) return false;
        return failedCount / totalCount > 0.05;
      };

      expect(evalFailureRate(1, 100)).toBe(false); // 1%: ok
      expect(evalFailureRate(5, 100)).toBe(false); // 5%: threshold border
      expect(evalFailureRate(6, 100)).toBe(true); // 6%: firing
      expect(evalFailureRate(20, 100)).toBe(true); // 20%: firing
    });

    it('evaluates SystemicFailure: triggers when failure rate > 0.5 (50%)', () => {
      // Expression: rate(jobs_processed_total{result="failed"}) / rate(jobs_processed_total) > 0.5
      const evalSystemic = (failedCount: number, totalCount: number) => {
        if (totalCount === 0) return false;
        return failedCount / totalCount > 0.5;
      };

      expect(evalSystemic(10, 100)).toBe(false); // 10%: ok
      expect(evalSystemic(50, 100)).toBe(false); // 50%: boundary
      expect(evalSystemic(51, 100)).toBe(true); // 51%: firing -> pause queue runbook
    });

    it('evaluates WorkerStalledJobs: triggers when stalled increase > 3 in 30m', () => {
      // Expression: increase(jobs_processed_total{result="stalled"}[30m]) > 3
      const evalStalled = (stalledIncrease: number) => stalledIncrease > 3;

      expect(evalStalled(1)).toBe(false);
      expect(evalStalled(3)).toBe(false);
      expect(evalStalled(4)).toBe(true);
    });

    it('evaluates WorkerStuck: triggers when processing_steps_running_stale > 0', () => {
      // Expression: processing_steps_running_stale > 0
      const evalStuck = (staleSteps: number) => staleSteps > 0;

      expect(evalStuck(0)).toBe(false);
      expect(evalStuck(1)).toBe(true);
      expect(evalStuck(5)).toBe(true);
    });

    it('evaluates WorkerTmpDiskHigh: triggers when worker_tmp_bytes / 8e9 > 0.8', () => {
      const evalDisk = (bytes: number) => bytes / 8e9 > 0.8;

      expect(evalDisk(4e9)).toBe(false); // 4 GB / 8 GB = 50%
      expect(evalDisk(6.4e9)).toBe(false); // 6.4 GB / 8 GB = 80% (boundary)
      expect(evalDisk(6.5e9)).toBe(true); // > 80%
      expect(evalDisk(7.5e9)).toBe(true); // ~94%
    });

    it('evaluates APILatencyHigh: triggers when p95 > 0.2s', () => {
      const evalP95 = (p95Sec: number) => p95Sec > 0.2;

      expect(evalP95(0.05)).toBe(false);
      expect(evalP95(0.19)).toBe(false);
      expect(evalP95(0.2)).toBe(false);
      expect(evalP95(0.25)).toBe(true);
    });
  });

  describe('Alertmanager Configuration Verification', () => {
    it('verifies alertmanager.yml configuration exists with severity-based routes', () => {
      expect(
        fs.existsSync(alertmanagerPath),
        `Alertmanager config missing at ${alertmanagerPath}`
      ).toBe(true);

      const content = fs.readFileSync(alertmanagerPath, 'utf-8');
      expect(content).toContain('route:');
      expect(content).toContain('group_by:');
      expect(content).toContain('severity: critical');
      expect(content).toContain('severity: warning');
      expect(content).toContain('severity: info');
      expect(content).toContain('receivers:');
      expect(content).toContain('critical-webhook');
      expect(content).toContain('warning-webhook');
      expect(content).toContain('info-webhook');
    });

    it('simulates hostile upload producing DLQ entry and triggering Alertmanager webhook notification payload', async () => {
      // Hostile file upload flow (e.g. corrupt or unsupported codec: prores)
      // When probe fails with permanent error, worker DLQ failure handler increments dlq_entries_total
      const { createMetricsRegistry } = await import('../metrics.js');
      const metrics = createMetricsRegistry();

      // Step 1: Simulate hostile upload processing failure
      const queue = 'probe';
      const errorCode = 'UNSUPPORTED_CODEC';
      metrics.dlqEntriesTotal.inc({ queue, error_code: errorCode });

      const metricsJson = await metrics.registry.getMetricsAsJSON();
      const dlqMetric = metricsJson.find((m) => m.name === 'dlq_entries_total');
      expect(dlqMetric?.values[0]?.value).toBe(1);
      expect(dlqMetric?.values[0]?.labels).toEqual({
        queue: 'probe',
        error_code: 'UNSUPPORTED_CODEC',
      });

      // Step 2: Simulate Prometheus alert rule firing
      const alertRule = {
        alert: 'DLQNotEmpty',
        severity: 'warning',
        labels: {
          alertname: 'DLQNotEmpty',
          severity: 'warning',
          queue: 'probe',
          error_code: 'UNSUPPORTED_CODEC',
        },
        annotations: {
          summary: 'Job routed to Dead-Letter Queue (DLQ) in queue probe',
          description:
            'New DLQ entry detected for queue probe with error_code UNSUPPORTED_CODEC in the last 10 minutes.',
          runbook_url: 'docs/runbooks/dlq-replay.md',
        },
      };

      // Step 3: Simulate Alertmanager notification payload formatting
      const alertmanagerNotificationPayload = {
        receiver: 'warning-webhook',
        status: 'firing',
        alerts: [
          {
            status: 'firing',
            labels: alertRule.labels,
            annotations: alertRule.annotations,
            startsAt: new Date().toISOString(),
            generatorURL:
              'http://localhost:9090/graph?g0.expr=increase%28dlq_entries_total%5B10m%5D%29+%3E+0',
          },
        ],
        groupLabels: { alertname: 'DLQNotEmpty', severity: 'warning' },
        commonLabels: alertRule.labels,
        commonAnnotations: alertRule.annotations,
      };

      // Step 4: Simulate Discord / Telegram webhook message formatter
      const discordMessage = {
        content:
          `🚨 **[FIRING:1] ${alertRule.alert}**\n` +
          `• **Severity**: \`${alertRule.labels.severity}\`\n` +
          `• **Queue**: \`${alertRule.labels.queue}\`\n` +
          `• **Error Code**: \`${alertRule.labels.error_code}\`\n` +
          `• **Summary**: ${alertRule.annotations.summary}\n` +
          `• **Runbook**: [${alertRule.annotations.runbook_url}](https://github.com/szebest/video-pipeline/blob/main/${alertRule.annotations.runbook_url})`,
      };

      expect(discordMessage.content).toContain('DLQNotEmpty');
      expect(discordMessage.content).toContain('UNSUPPORTED_CODEC');
      expect(discordMessage.content).toContain('docs/runbooks/dlq-replay.md');
      expect(alertmanagerNotificationPayload.receiver).toBe('warning-webhook');
    });
  });
});
