import { loadEnvOrExit } from '@kit/config';
import { createLogger } from '@kit/logger';
import { isErr } from '@kit/result';
import { toAppConfig } from '@vp/env-schema';
import { initTracing } from '@vp/observability/tracing-sdk';

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
