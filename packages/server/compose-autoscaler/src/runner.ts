import type { Logger } from '@vp/logger';
import {
  DEFAULT_STAGE_CONFIGS,
  type ScalerStageConfig,
  type StageScalingState,
  computeReplicas,
  parsePrometheusQueueMetrics,
} from './scaler';

/** How a call to the outside world went, answered rather than thrown. */
export type Attempt<T> =
  | { readonly type: 'done'; readonly value: T }
  | { readonly type: 'failed'; readonly reason: string };

export interface AutoscalerOptions {
  metricsUrl: string;
  composeFile?: string;
  dryRun?: boolean;
  pollIntervalMs?: number;
  stageConfigs?: Record<string, ScalerStageConfig>;
  logger: Logger;
  executor: (cmd: string) => Promise<Attempt<unknown>>;
  fetcher: (url: string) => Promise<Attempt<string>>;
}

export class ComposeAutoscaler {
  private readonly metricsUrl: string;
  private readonly composeFile?: string;
  private readonly dryRun: boolean;
  private readonly pollIntervalMs: number;
  private readonly configs: Record<string, ScalerStageConfig>;
  private readonly states: Map<string, StageScalingState> = new Map();
  private readonly log: Logger;
  private readonly execCmd: AutoscalerOptions['executor'];
  private readonly fetchMetrics: AutoscalerOptions['fetcher'];
  private isRunning = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: AutoscalerOptions) {
    this.metricsUrl = options.metricsUrl;
    this.composeFile = options.composeFile;
    this.dryRun = options.dryRun ?? false;
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
    this.configs = options.stageConfigs ?? DEFAULT_STAGE_CONFIGS;
    this.log = options.logger;
    this.execCmd = options.executor;
    this.fetchMetrics = options.fetcher;

    for (const serviceName of Object.keys(this.configs)) {
      this.states.set(serviceName, {
        currentReplicas: this.configs[serviceName]?.minReplicas ?? 0,
        lastScaleDownTimeMs: 0,
        scaleDownCandidateSinceMs: null,
      });
    }
  }

  public getStates(): Map<string, StageScalingState> {
    return new Map(this.states);
  }

  public async tick(nowMs: number = Date.now()): Promise<void> {
    const metrics = await this.fetchMetrics(this.metricsUrl);
    if (metrics.type === 'failed') {
      this.log.warn({ reason: metrics.reason }, 'metrics poll failed');
      return;
    }
    const queueDepths = parsePrometheusQueueMetrics(metrics.value);

    for (const [serviceName, config] of Object.entries(this.configs)) {
      const queueName = serviceName.replace(/^worker-/, '');
      const depth = queueDepths[queueName] ?? { waiting: 0, prioritized: 0, active: 0 };
      const currentState = this.states.get(serviceName) ?? {
        currentReplicas: config.minReplicas,
        lastScaleDownTimeMs: 0,
        scaleDownCandidateSinceMs: null,
      };

      const decision = computeReplicas({
        config,
        state: currentState,
        queueDepth: depth,
        nowMs,
      });

      this.states.set(serviceName, decision.nextState);

      if (decision.action === 'hold') continue;

      const fileFlag = this.composeFile ? `-f ${this.composeFile} ` : '';
      const cmd = `docker compose ${fileFlag}up -d --scale ${serviceName}=${decision.targetReplicas} --no-recreate`;

      const scaling = {
        service: serviceName,
        reason: decision.reason,
        targetReplicas: decision.targetReplicas,
      };
      if (this.dryRun) {
        this.log.info({ ...scaling, command: cmd }, 'would scale (dry run)');
        continue;
      }

      this.log.info(scaling, 'scaling');
      const scaled = await this.execCmd(cmd);
      if (scaled.type === 'failed') {
        this.log.error({ service: serviceName, reason: scaled.reason }, 'scale command failed');
      }
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log.info(
      { metricsUrl: this.metricsUrl, pollIntervalMs: this.pollIntervalMs, dryRun: this.dryRun },
      'autoscaler started'
    );

    const loop = async () => {
      if (!this.isRunning) return;
      await this.tick();
      if (this.isRunning) {
        this.pollTimer = setTimeout(loop, this.pollIntervalMs);
      }
    };

    void loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.log.info('autoscaler stopped');
  }
}
