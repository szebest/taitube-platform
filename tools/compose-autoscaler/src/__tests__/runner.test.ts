import { describe, expect, it } from 'vitest';
import { ComposeAutoscaler } from '../runner';
import type { ScalerStageConfig } from '../scaler';

describe('ComposeAutoscaler runner integration', () => {
  const customConfig: Record<string, ScalerStageConfig> = {
    'worker-transcode-1080p': {
      minReplicas: 1,
      maxReplicas: 5,
      threshold: 1,
      cooldownSeconds: 300,
    },
  };

  it('runs tick in dry-run mode and logs intended scaling commands without executing', async () => {
    const executedCommands: string[] = [];
    const loggedMessages: string[] = [];

    const sampleMetrics = `
# HELP bullmq_queue_jobs Number of jobs in queue by state
bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} 4
bullmq_queue_jobs{queue="transcode-1080p",state="active"} 0
`;

    const autoscaler = new ComposeAutoscaler({
      metricsUrl: 'http://mock-api:9464/metrics',
      dryRun: true,
      stageConfigs: customConfig,
      composeFile: 'infra/compose/docker-compose.yml',
      fetcher: async () => sampleMetrics,
      executor: async (cmd) => {
        executedCommands.push(cmd);
        return { stdout: '', stderr: '' };
      },
      onLog: (msg) => loggedMessages.push(msg),
    });

    await autoscaler.tick(1000);

    // Dry run must NOT execute commands
    expect(executedCommands.length).toBe(0);

    // But MUST log the intended command
    const dryRunLog = loggedMessages.find((m) => m.includes('[DRY-RUN]'));
    expect(dryRunLog).toBeDefined();
    expect(dryRunLog).toContain('worker-transcode-1080p');
    expect(dryRunLog).toContain('Target: 4');
    expect(dryRunLog).toContain(
      'docker compose -f infra/compose/docker-compose.yml up -d --scale worker-transcode-1080p=4 --no-recreate'
    );
  });

  it('executes docker compose scale command when dryRun is false', async () => {
    const executedCommands: string[] = [];

    const sampleMetrics = `
bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} 2
bullmq_queue_jobs{queue="transcode-1080p",state="active"} 1
`;

    const autoscaler = new ComposeAutoscaler({
      metricsUrl: 'http://mock-api:9464/metrics',
      dryRun: false,
      stageConfigs: customConfig,
      fetcher: async () => sampleMetrics,
      executor: async (cmd) => {
        executedCommands.push(cmd);
        return { stdout: '', stderr: '' };
      },
      onLog: () => {},
    });

    await autoscaler.tick(1000);

    expect(executedCommands.length).toBe(1);
    expect(executedCommands[0]).toBe(
      'docker compose up -d --scale worker-transcode-1080p=3 --no-recreate'
    );
  });

  it('handles burst of 20 uploads: scales to max (5), drains, and returns to min (1) after cooldown', async () => {
    const logs: string[] = [];
    let currentWaiting = 20;
    let currentActive = 0;

    const autoscaler = new ComposeAutoscaler({
      metricsUrl: 'http://mock-api:9464/metrics',
      dryRun: true,
      stageConfigs: customConfig,
      fetcher: async () => `
bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} ${currentWaiting}
bullmq_queue_jobs{queue="transcode-1080p",state="active"} ${currentActive}
`,
      onLog: (msg) => logs.push(msg),
    });

    // 1. Initial burst: 20 waiting -> should scale to max (5)
    await autoscaler.tick(0);
    expect(logs.some((l) => l.includes('scaled up') && l.includes('Target: 5'))).toBe(true);

    // 2. Transcode completes, queue empty at t = 60s
    currentWaiting = 0;
    currentActive = 0;
    await autoscaler.tick(60_000);
    // At t = 60s, cooldown (300s) has not elapsed: should hold 5
    const stateAt60s = autoscaler.getStates().get('worker-transcode-1080p');
    expect(stateAt60s?.currentReplicas).toBe(5);

    // 3. At t = 361s (301s after drain started at 60s): cooldown expires, scales down to min (1)
    await autoscaler.tick(361_000);
    expect(logs.some((l) => l.includes('Cooldown period elapsed') && l.includes('Target: 1'))).toBe(
      true
    );
    const stateAt361s = autoscaler.getStates().get('worker-transcode-1080p');
    expect(stateAt361s?.currentReplicas).toBe(1);
  });
});
