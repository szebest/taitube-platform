import { loadEnvOrExit } from '@kit/config';
import { createLogger } from '@kit/logger';
import { isErr } from '@kit/result';
import { toAppConfig } from '@vp/env-schema';
import { initTracing } from '@vp/observability/tracing-sdk';

const env = loadEnvOrExit('vp-api', process);
if (env) {
  const { otel, logLevel } = toAppConfig(env);
  const traced = initTracing({ serviceName: 'vp-api', ...otel });
  if (isErr(traced)) {
    const log = createLogger({ service: 'vp-api', level: logLevel, format: 'json' });
    log.warn({ err: traced.error }, 'tracing disabled');
  }
}
