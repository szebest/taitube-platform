import { loadEnvOrExit } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { initTracing } from '@vp/observability';
import { isErr } from '@vp/result';

const env = loadEnvOrExit('vp-api', { env: process.env, exit: (code) => process.exit(code) });
const { otel, logLevel } = toAppConfig(env);
const traced = initTracing({ serviceName: 'vp-api', ...otel });
if (isErr(traced)) {
  const log = createLogger({ service: 'vp-api', level: logLevel, format: 'json' });
  log.warn({ err: traced.error }, 'tracing disabled');
}
