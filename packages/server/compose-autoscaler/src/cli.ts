import * as fs from 'node:fs';
import { parseArgs } from 'node:util';
import type { Logger } from '@vp/logger';
import { type AutoscalerOptions, ComposeAutoscaler } from './runner';
import { DEFAULT_STAGE_CONFIGS, type ScalerStageConfig } from './scaler';

type Env = Readonly<Record<string, string | undefined>>;

type StageOverrides = Record<string, ScalerStageConfig>;

export interface CliHost {
  argv: readonly string[];
  env: Env;
  executor: AutoscalerOptions['executor'];
  fetcher: AutoscalerOptions['fetcher'];
  onSignal: (signal: 'SIGINT' | 'SIGTERM', handler: () => void) => void;
  exit: (code: number) => void;
  print: (text: string) => void;
  log: Logger;
}

interface CliArgs {
  metricsUrl: string;
  composeFile?: string;
  dryRun: boolean;
  intervalSec: number;
  configFile?: string;
  help?: boolean;
}

function parseCliArgs(argv: readonly string[], env: Env): CliArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      url: { type: 'string' },
      file: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      interval: { type: 'string', default: '10' },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const metricsPort = env.METRICS_PORT || '9464';
  const defaultMetricsUrl = `http://localhost:${metricsPort}/metrics`;

  return {
    metricsUrl: values.url || env.METRICS_URL || defaultMetricsUrl,
    composeFile: values.file || env.COMPOSE_FILE,
    dryRun: values['dry-run'],
    intervalSec: Number.parseInt(values.interval, 10),
    configFile: values.config,
    help: values.help,
  };
}

function printHelp(host: CliHost): void {
  host.print(`
@vp/compose-autoscaler — Docker Compose Queue-Depth Autoscaler

Polls Prometheus metrics (/metrics) from the API and dynamically scales
worker stages via 'docker compose up -d --scale <service>=N --no-recreate'.

Usage:
  pnpm compose-autoscaler [options]

Options:
  --url <url>              Metrics URL (default: http://localhost:9464/metrics or env METRICS_URL)
  --file <path>            Path to docker-compose.yml file (optional)
  --dry-run                Print intended scale actions without executing docker commands
  --interval <seconds>     Polling interval in seconds (default: 10)
  --config <path>          Path to JSON file with custom stage configs (min, max, threshold, cooldown)
  --help, -h               Show this help message

Environment Variables:
  METRICS_URL              Full URL to Prometheus /metrics endpoint
  METRICS_PORT             Port for default metrics endpoint (default: 9464)
  COMPOSE_FILE             Path to compose file
  AUTOSCALER_DRY_RUN       Set to "true" to run in dry-run mode
  AUTOSCALER_CONFIG        JSON string of per-stage configs
`);
}

function readStageOverrides(env: Env, configFile?: string): StageOverrides {
  if (configFile) {
    const text = fs.readFileSync(configFile, 'utf-8');
    return JSON.parse(text) as StageOverrides;
  }
  if (env.AUTOSCALER_CONFIG) {
    return JSON.parse(env.AUTOSCALER_CONFIG) as StageOverrides;
  }
  return {};
}

export function run(host: CliHost): void {
  const args = parseCliArgs(host.argv, host.env);

  if (args.help) {
    printHelp(host);
    return;
  }

  const overrides = readStageOverrides(host.env, args.configFile);

  const autoscaler = new ComposeAutoscaler({
    metricsUrl: args.metricsUrl,
    composeFile: args.composeFile,
    dryRun: args.dryRun || host.env.AUTOSCALER_DRY_RUN === 'true',
    pollIntervalMs: args.intervalSec * 1000,
    stageConfigs: { ...DEFAULT_STAGE_CONFIGS, ...overrides },
    logger: host.log,
    executor: host.executor,
    fetcher: host.fetcher,
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    host.onSignal(signal, () => {
      autoscaler.stop();
      host.exit(0);
    });
  }

  autoscaler.start();
}
