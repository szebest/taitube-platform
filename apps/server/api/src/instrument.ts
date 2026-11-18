import { loadEnvOrExit } from '@kit/config';
import { createLogger } from '@kit/logger';
import { initTracing } from '@kit/observability/tracing-sdk';
import { isErr } from '@kit/result';
import { AppEnvSchema, DEFAULT_LOG_LEVEL, toAppConfig } from '@vp/env-schema';

const env = loadEnvOrExit(AppEnvSchema, DEFAULT_LOG_LEVEL, 'vp-api', process);
if (env) {
  const { otel, logLevel } = toAppConfig(env);
  const traced = initTracing({ serviceName: 'vp-api', ...otel });
  if (isErr(traced)) {
    const log = createLogger({ service: 'vp-api', level: logLevel, format: 'json' });
    log.warn({ err: traced.error }, 'tracing disabled');
  }
}
