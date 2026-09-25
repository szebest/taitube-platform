import { type LogLine, captureLog } from '@vp/testing/log-capture';
import { createLogger } from '@vp/logger';
import { type Attempt, ComposeAutoscaler } from '../runner';
import type { ScalerStageConfig } from '../scaler';

function recordingLogger() {
  const log = captureLog();
  const logger = createLogger({
    service: 'compose-autoscaler',
    level: 'info',
    format: 'json',
    destination: log.destination,
  });
  return { log, logger };
}

const withMessage = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

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
    const { log, logger } = recordingLogger();

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
      fetcher: async () => ({ type: 'done', value: sampleMetrics }),
      executor: async (cmd) => {
        executedCommands.push(cmd);
        return { type: 'done', value: '' };
      },
      logger,
    });

    await autoscaler.tick(1000);

    expect(executedCommands.length).toBe(0);
    expect(withMessage(log.lines(), 'would scale (dry run)')).toEqual([
      expect.objectContaining({
        service: 'worker-transcode-1080p',
        targetReplicas: 4,
        command:
          'docker compose -f infra/compose/docker-compose.yml up -d --scale worker-transcode-1080p=4 --no-recreate',
      }),
    ]);
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
      fetcher: async () => ({ type: 'done', value: sampleMetrics }),
      executor: async (cmd) => {
        executedCommands.push(cmd);
        return { type: 'done', value: '' };
      },
      logger: recordingLogger().logger,
    });

    await autoscaler.tick(1000);

    expect(executedCommands.length).toBe(1);
    expect(executedCommands[0]).toBe(
      'docker compose up -d --scale worker-transcode-1080p=3 --no-recreate'
    );
  });

  it('handles burst of 20 uploads: scales to max (5), drains, and returns to min (1) after cooldown', async () => {
    const { log, logger } = recordingLogger();
    let currentWaiting = 20;
    let currentActive = 0;

    const autoscaler = new ComposeAutoscaler({
      metricsUrl: 'http://mock-api:9464/metrics',
      dryRun: true,
      stageConfigs: customConfig,
      fetcher: async () => ({
        type: 'done',
        value: `
bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} ${currentWaiting}
bullmq_queue_jobs{queue="transcode-1080p",state="active"} ${currentActive}
`,
      }),
      executor: async () => ({ type: 'done', value: '' }),
      logger,
    });

    await autoscaler.tick(0);
    const [scaledUp] = withMessage(log.lines(), 'would scale (dry run)');
    expect(scaledUp).toMatchObject({
      targetReplicas: 5,
      reason: expect.stringContaining('scaled up'),
    });

    currentWaiting = 0;
    currentActive = 0;
    await autoscaler.tick(60_000);
    const stateAt60s = autoscaler.getStates().get('worker-transcode-1080p');
    expect(stateAt60s?.currentReplicas).toBe(5);

    await autoscaler.tick(361_000);
    const scaledDown = withMessage(log.lines(), 'would scale (dry run)').at(-1);
    expect(scaledDown).toMatchObject({
      targetReplicas: 1,
      reason: expect.stringContaining('Cooldown period elapsed'),
    });
    const stateAt361s = autoscaler.getStates().get('worker-transcode-1080p');
    expect(stateAt361s?.currentReplicas).toBe(1);
  });

  it.each([
    {
      scenario: 'the metrics endpoint is unreachable',
      fetcher: async (): Promise<Attempt<string>> => ({
        type: 'failed',
        reason: 'Error: ECONNREFUSED',
      }),
      executor: async (): Promise<Attempt<unknown>> => ({ type: 'done', value: '' }),
      logged: { level: 'warn', msg: 'metrics poll failed', reason: 'Error: ECONNREFUSED' },
    },
    {
      scenario: 'the scale command fails',
      fetcher: async (): Promise<Attempt<string>> => ({
        type: 'done',
        value: 'bullmq_queue_jobs{queue="transcode-1080p",state="waiting"} 2',
      }),
      executor: async (): Promise<Attempt<unknown>> => ({
        type: 'failed',
        reason: 'Error: compose binary missing',
      }),
      logged: {
        level: 'error',
        msg: 'scale command failed',
        service: 'worker-transcode-1080p',
        reason: 'Error: compose binary missing',
      },
    },
  ])('logs rather than throws when $scenario', async ({ fetcher, executor, logged }) => {
    const { log, logger } = recordingLogger();
    const autoscaler = new ComposeAutoscaler({
      metricsUrl: 'http://mock-api:9464/metrics',
      stageConfigs: customConfig,
      fetcher,
      executor,
      logger,
    });

    await expect(autoscaler.tick(1000)).resolves.toBeUndefined();
    expect(log.lines()).toContainEqual(expect.objectContaining(logged));
  });
});
