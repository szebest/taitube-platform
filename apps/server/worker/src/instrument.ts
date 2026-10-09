import { loadEnvOrExit } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { initTracing } from '@vp/observability/tracing-sdk';
import { isErr } from '@vp/result';

const env = loadEnvOrExit('vp-worker', process);
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
