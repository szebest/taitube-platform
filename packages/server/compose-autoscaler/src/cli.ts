import * as fs from 'node:fs';
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
}

interface CliArgs {
  metricsUrl: string;
  composeFile?: string;
  dryRun: boolean;
  intervalSec: number;
  configFile?: string;
  help?: boolean;
}

function parseCliArgs(args: string[], env: Env): CliArgs {
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      flags.help = 'true';
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    }
  }

  const metricsPort = env.METRICS_PORT || '9464';
  const defaultMetricsUrl = `http://localhost:${metricsPort}/metrics`;

  return {
    metricsUrl: flags.url || env.METRICS_URL || defaultMetricsUrl,
    composeFile: flags.file || env.COMPOSE_FILE,
    dryRun: flags['dry-run'] === 'true' || flags.dryRun === 'true',
    intervalSec: Number.parseInt(flags.interval || flags['poll-interval'] || '10', 10),
    configFile: flags.config,
    help: flags.help === 'true',
  };
}

function printHelp(): void {
  console.log(`
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
  const args = parseCliArgs([...host.argv], host.env);

  if (args.help) {
    printHelp();
    return;
  }

  const overrides = readStageOverrides(host.env, args.configFile);

  const autoscaler = new ComposeAutoscaler({
    metricsUrl: args.metricsUrl,
    composeFile: args.composeFile,
    dryRun: args.dryRun || host.env.AUTOSCALER_DRY_RUN === 'true',
    pollIntervalMs: args.intervalSec * 1000,
    stageConfigs: { ...DEFAULT_STAGE_CONFIGS, ...overrides },
    onLog: console.log,
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
