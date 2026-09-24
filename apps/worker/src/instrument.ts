import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { initTracing } from '@vp/observability';
import { isErr } from '@vp/result';

const { otel, worker, logLevel } = toAppConfig(loadEnv(process.env));
const traced = initTracing({ serviceName: `vp-worker-${worker.stage}`, ...otel });
if (isErr(traced)) {
  const log = createLogger({ service: `worker-${worker.stage}`, level: logLevel, format: 'json' });
  log.warn({ err: traced.error }, 'tracing disabled');
}
