import * as fs from 'node:fs';
import { type Result, isErr, ok, tryCatch } from '@vp/result';
import { ComposeAutoscaler } from './runner';
import { DEFAULT_STAGE_CONFIGS, type ScalerStageConfig } from './scaler';

interface CliArgs {
  metricsUrl: string;
  composeFile?: string;
  dryRun: boolean;
  intervalSec: number;
  configFile?: string;
  help?: boolean;
}

function parseCliArgs(args: string[]): CliArgs {
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

  const metricsPort = process.env.METRICS_PORT || '9464';
  const defaultMetricsUrl = `http://localhost:${metricsPort}/metrics`;

  return {
    metricsUrl: flags.url || process.env.METRICS_URL || defaultMetricsUrl,
    composeFile: flags.file || process.env.COMPOSE_FILE,
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

type StageOverrides = Record<string, ScalerStageConfig>;

interface OverridesUnreadable {
  message: string;
  cause: unknown;
}

function parseOverrides(
  read: () => string,
  label: string
): Result<StageOverrides, OverridesUnreadable> {
  return tryCatch(
    (): StageOverrides => JSON.parse(read()),
    (cause) => ({ message: `Failed to load ${label}:`, cause })
  );
}

function readStageOverrides(configFile?: string): Result<StageOverrides, OverridesUnreadable> {
  if (configFile) {
    return parseOverrides(() => fs.readFileSync(configFile, 'utf-8'), `config file ${configFile}`);
  }
  const inline = process.env.AUTOSCALER_CONFIG;
  return inline ? parseOverrides(() => inline, 'AUTOSCALER_CONFIG JSON') : ok({});
}

export async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const overrides = readStageOverrides(args.configFile);
  if (isErr(overrides)) {
    console.error(overrides.error.message, overrides.error.cause);
    process.exit(1);
  }
  const stageConfigs = { ...DEFAULT_STAGE_CONFIGS, ...overrides.value };

  const dryRun = args.dryRun || process.env.AUTOSCALER_DRY_RUN === 'true';

  const autoscaler = new ComposeAutoscaler({
    metricsUrl: args.metricsUrl,
    composeFile: args.composeFile,
    dryRun,
    pollIntervalMs: args.intervalSec * 1000,
    stageConfigs,
  });

  process.on('SIGINT', () => {
    autoscaler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    autoscaler.stop();
    process.exit(0);
  });

  autoscaler.start();
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal autoscaler error:', err);
    process.exit(1);
  });
}
