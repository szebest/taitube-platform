import type { ProcessHost } from '@vp/composition';
import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import type { Logger } from '@vp/logger';
import { registeredTracing } from '@vp/observability';
import { fromPromise, isErr } from '@vp/result';
import { composeApp } from './app';
import { type ApiProcess, serve } from './serve';

async function start(host: ProcessHost): Promise<ApiProcess> {
  const config = toAppConfig(loadEnv(host.env));
  return serve(await composeApp({ config }), config, { tracing: registeredTracing, signals: host });
}

/**
 * `log` is for a start that fails before the app has a logger of its own. Resolves to `undefined`
 * once a fatal boot error has asked the host to exit 1.
 */
export async function run(host: ProcessHost, log: Logger): Promise<ApiProcess | undefined> {
  const started = await fromPromise(
    () => start(host),
    (cause) => cause
  );
  if (isErr(started)) {
    log.fatal({ err: started.error }, 'api could not start');
    host.exit(1);
    return undefined;
  }
  return started.value;
}
