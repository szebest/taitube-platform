import { loadEnvOrExit } from '@kit/config';
import { createLogger } from '@kit/logger';
import { initTracing } from '@kit/observability/tracing-sdk';
import { isErr } from '@kit/result';
import { AppEnvSchema, DEFAULT_LOG_LEVEL, toAppConfig } from '@vp/env-schema';

const env = loadEnvOrExit(AppEnvSchema, DEFAULT_LOG_LEVEL, 'vp-worker', process);
if (env) {
  const { otel, worker, logLevel } = toAppConfig(env);
  const traced = initTracing({ serviceName: `vp-worker-${worker.stage}`, ...otel });
  if (isErr(traced)) {
    const log = createLogger({
      service: `worker-${worker.stage}`,
      level: logLevel,
      format: 'json',
    });
    log.warn({ err: traced.error }, 'tracing disabled');
  }
}
