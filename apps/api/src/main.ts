import { type ShutdownOutcome, shutdownOnce } from '@vp/composition';
import { loadEnv } from '@vp/config';
import { type AppConfig, toAppConfig } from '@vp/env-schema';
import { type AnyFailure, toPipelineError } from '@vp/errors';
import { initTracing, shutdownTracing } from '@vp/observability';
import { fromPromise, isErr } from '@vp/result';
import { type ComposedApp, composeApp } from './app';
import { startMetricsServer } from './plugins/metrics';

/**
 * `infra/k8s/base/api.yaml` gives the pod 30 s: a 5 s preStop, then SIGTERM. The drain delay
 * keeps the listener open while readiness reads 503, and the grace window ends 5 s before the
 * kubelet's SIGKILL so a wedged disposer is named in the log rather than killed silently.
 */
export const API_SHUTDOWN = { drainDelayMs: 2_000, graceMs: 20_000 } as const;

export interface ApiProcess {
  address: string;
  shutdown: () => Promise<ShutdownOutcome>;
}

export async function serve(
  { app, container }: ComposedApp,
  config: AppConfig,
  timings: { drainDelayMs: number; graceMs: number } = API_SHUTDOWN
): Promise<ApiProcess> {
  const started = await container.start();
  if (isErr(started)) {
    console.error(`[api] startup failed at ${started.error.token}:`, started.error.cause);
    await app.close();
    throw toPipelineError(started.error.cause as AnyFailure);
  }

  const address = await app.listen({ port: config.http.port, host: '0.0.0.0' });
  console.log(`[api] Fastify server listening on ${address}`);

  const metricsServer = await startMetricsServer(config.http.metricsPort);
  console.log(`[api] Metrics server listening on http://0.0.0.0:${metricsServer.port}/metrics`);

  const shutdown = shutdownOnce({
    ...timings,
    drain: () => app.services.readiness.beginDrain(),
    close: async () => {
      const closed = await fromPromise(
        () => app.close(),
        (cause) => cause
      );
      await metricsServer.close();
      await shutdownTracing();
      if (isErr(closed)) throw closed.error;
    },
    pending: () => container.disposing(),
    log: (message) => console.log(`[api] ${message}`),
  });

  return { address, shutdown };
}

export async function main(
  env: Record<string, string | undefined> = process.env
): Promise<ApiProcess> {
  const config = toAppConfig(loadEnv(env));
  initTracing({ serviceName: 'vp-api', ...config.otel });

  return serve(await composeApp({ config }), config);
}

if (process.env.NODE_ENV !== 'test') {
  main()
    .then(({ shutdown }) => {
      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.on(signal, () => {
          void shutdown().then((outcome) => process.exit(outcome === 'drained' ? 0 : 1));
        });
      }
    })
    .catch((err) => {
      console.error('Fatal API error:', err);
      process.exit(1);
    });
}
