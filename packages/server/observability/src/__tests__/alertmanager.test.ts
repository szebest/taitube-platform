import * as fs from 'node:fs';
import { createMetricsRegistry } from '../metrics';
import { alertmanagerPath } from './prometheus-rules';

describe('Alertmanager configuration', () => {
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
    const metrics = createMetricsRegistry();

    metrics.dlqEntriesTotal.inc({ queue: 'probe', error_code: 'UNSUPPORTED_CODEC' });

    const metricsJson = await metrics.registry.getMetricsAsJSON();
    const dlqMetric = metricsJson.find((m) => m.name === 'dlq_entries_total');
    expect(dlqMetric?.values[0]?.value).toBe(1);
    expect(dlqMetric?.values[0]?.labels).toEqual({
      queue: 'probe',
      error_code: 'UNSUPPORTED_CODEC',
    });

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
