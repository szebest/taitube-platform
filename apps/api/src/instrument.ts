import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { initTracing } from '@vp/observability';
import { isErr } from '@vp/result';

const { otel } = toAppConfig(loadEnv(process.env));
const traced = initTracing({ serviceName: 'vp-api', ...otel });
if (isErr(traced)) console.warn(`[api] tracing disabled: ${traced.error.message}`);
