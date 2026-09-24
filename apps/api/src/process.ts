import type { ProcessHost } from '@vp/composition';
import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { initTracing } from '@vp/observability';
import { fromPromise, isErr, ok } from '@vp/result';
import { composeApp } from './app';
import { type ApiProcess, serve } from './serve';

async function start(host: ProcessHost): Promise<ApiProcess> {
  const config = toAppConfig(loadEnv(host.env, { exitOnError: false }));
  const traced = initTracing({ serviceName: 'vp-api', ...config.otel });
  if (isErr(traced)) console.warn(`[api] tracing disabled: ${traced.error.message}`);
  const tracing = traced.ok ? traced.value : { shutdown: async () => ok() };

  return serve(await composeApp({ config }), config, { tracing, signals: host });
}

/** Resolves to `undefined` once a fatal boot error has asked the host to exit 1. */
export async function run(host: ProcessHost): Promise<ApiProcess | undefined> {
  const started = await fromPromise(
    () => start(host),
    (cause) => cause
  );
  if (isErr(started)) {
    console.error('Fatal API error:', started.error);
    host.exit(1);
    return undefined;
  }
  return started.value;
}
