import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DEFAULT_STAGE_CONFIGS,
  type ScalerStageConfig,
  type StageScalingState,
  computeReplicas,
  parsePrometheusQueueMetrics,
} from './scaler.js';

const execAsync = promisify(exec);

export interface AutoscalerOptions {
  metricsUrl: string;
  composeFile?: string;
  dryRun?: boolean;
  pollIntervalMs?: number;
  stageConfigs?: Record<string, ScalerStageConfig>;
  onLog?: (msg: string) => void;
  executor?: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
  fetcher?: (url: string) => Promise<string>;
}

export class ComposeAutoscaler {
  private readonly metricsUrl: string;
  private readonly composeFile?: string;
  private readonly dryRun: boolean;
  private readonly pollIntervalMs: number;
  private readonly configs: Record<string, ScalerStageConfig>;
  private readonly states: Map<string, StageScalingState> = new Map();
  private readonly log: (msg: string) => void;
  private readonly execCmd: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
  private readonly fetchMetrics: (url: string) => Promise<string>;
  private isRunning = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: AutoscalerOptions) {
    this.metricsUrl = options.metricsUrl;
    this.composeFile = options.composeFile;
    this.dryRun = options.dryRun ?? false;
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
    this.configs = options.stageConfigs ?? DEFAULT_STAGE_CONFIGS;
    this.log = options.onLog ?? console.log;
    this.execCmd = options.executor ?? (async (cmd) => execAsync(cmd));
    this.fetchMetrics =
      options.fetcher ??
      (async (url) => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch metrics: ${res.status} ${res.statusText}`);
        }
        return res.text();
      });

    // Initialize states
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

  /**
   * Run one iteration of polling metrics and evaluating scaling rules.
   */
  public async tick(nowMs: number = Date.now()): Promise<void> {
    try {
      const metricsText = await this.fetchMetrics(this.metricsUrl);
      const queueDepths = parsePrometheusQueueMetrics(metricsText);

      for (const [serviceName, config] of Object.entries(this.configs)) {
        // Map compose service name (e.g. 'worker-transcode-1080p') to queue name ('transcode-1080p')
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

        if (decision.action !== 'hold') {
          const fileFlag = this.composeFile ? `-f ${this.composeFile} ` : '';
          const cmd = `docker compose ${fileFlag}up -d --scale ${serviceName}=${decision.targetReplicas} --no-recreate`;

          if (this.dryRun) {
            this.log(
              `[DRY-RUN] [${serviceName}] ${decision.reason} -> Target: ${decision.targetReplicas} (Command: ${cmd})`
            );
          } else {
            this.log(
              `[SCALING] [${serviceName}] ${decision.reason} -> Target: ${decision.targetReplicas}`
            );
            try {
              await this.execCmd(cmd);
            } catch (err) {
              this.log(
                `[ERROR] Failed to execute scale command for ${serviceName}: ${String(err)}`
              );
            }
          }
        }
      }
    } catch (err) {
      this.log(`[WARN] Autoscaler poll iteration failed: ${String(err)}`);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log(
      `[AUTOSCALER] Started polling ${this.metricsUrl} every ${this.pollIntervalMs / 1000}s (dryRun: ${this.dryRun})`
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
    this.log('[AUTOSCALER] Stopped.');
  }
}
