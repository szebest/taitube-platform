import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { initTracing } from '@vp/observability';
import { isErr } from '@vp/result';

const { otel, worker } = toAppConfig(loadEnv(process.env));
const traced = initTracing({ serviceName: `vp-worker-${worker.stage}`, ...otel });
if (isErr(traced)) console.warn(`[worker] tracing disabled: ${traced.error.message}`);
