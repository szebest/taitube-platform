import {
  type ProcessHost,
  type ShutdownOutcome,
  exitOnSignals,
  shutdownOnce,
} from '@vp/composition';
import type { AppConfig } from '@vp/env-schema';
import { asThrowable } from '@vp/errors';
import type { Tracing } from '@vp/observability';
import { assertNever, fromPromise, ignore, isErr } from '@vp/result';
import type { ComposedApp } from './app';
import { Services } from './composition/services.module';

/**
 * `infra/k8s/base/api.yaml` gives the pod 30 s: a 5 s preStop, then SIGTERM. The drain delay
 * keeps the listener open while readiness reads 503, and the grace window ends 5 s before the
 * kubelet's SIGKILL so a wedged disposer is named in the log rather than killed silently.
 */
const API_SHUTDOWN = { drainDelayMs: 2_000, graceMs: 20_000 } as const;

export interface ApiProcess {
  address: string;
  metricsPort: number;
  shutdown: () => Promise<ShutdownOutcome>;
}

interface ServeOptions {
  tracing: Tracing;
  timings?: { drainDelayMs: number; graceMs: number };
  /** Given by the process entry, so its signal handlers are in before the container starts. */
  signals?: ProcessHost;
}

export async function serve(
  { app, container }: ComposedApp,
  config: AppConfig,
  { tracing, timings = API_SHUTDOWN, signals }: ServeOptions
): Promise<ApiProcess> {
  const lifecycle: { phase: 'starting' | 'listening' | 'stopping' } = { phase: 'starting' };
  const shutdown = shutdownOnce({
    graceMs: timings.graceMs,
    get drainDelayMs() {
      return lifecycle.phase === 'listening' ? timings.drainDelayMs : 0;
    },
    drain: () => {
      if (lifecycle.phase === 'starting') lifecycle.phase = 'stopping';
      app.services.readiness.beginDrain();
    },
    close: async () => {
      const closed = await fromPromise(
        () => app.close(),
        (cause) => cause
      );
      ignore(
        await tracing.shutdown(),
        'spans that could not be flushed are lost either way; the close is what decides the exit'
      );
      if (isErr(closed)) throw closed.error;
    },
    pending: () => container.disposing(),
    log: (message) => console.log(`[api] ${message}`),
  });
  if (signals) exitOnSignals(signals, shutdown);

  const metricsPort = () => container.get(Services.MetricsServer).port;
  const started = await container.start();
  if (lifecycle.phase === 'stopping') return { address: '', metricsPort: metricsPort(), shutdown };
  if (isErr(started)) {
    switch (started.error.type) {
      case 'interrupted':
        return { address: '', metricsPort: metricsPort(), shutdown };
      case 'failed':
        console.error(`[api] startup failed at ${started.error.token}:`, started.error.cause);
        await app.close();
        throw asThrowable(started.error.cause);
      default:
        return assertNever(started.error, 'StartupFailed');
    }
  }

  const address = await app.listen({ port: config.http.port, host: '0.0.0.0' });
  lifecycle.phase = 'listening';
  console.log(`[api] Fastify server listening on ${address}`);
  console.log(`[api] Metrics on http://0.0.0.0:${metricsPort()}/metrics`);

  return { address, metricsPort: metricsPort(), shutdown };
}
