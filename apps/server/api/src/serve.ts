import {
  type ProcessHost,
  type ShutdownOutcome,
  exitOnSignals,
  shutdownOnce,
} from '@kit/composition';
import { ErrorCodeRegistry, asThrowable } from '@kit/errors';
import type { Tracing } from '@kit/observability';
import { assertNever, fromPromise, ignore, isErr } from '@kit/result';
import type { AppConfig } from '@vp/env-schema';
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
  const lifecycle: { phase: 'starting' | 'listening' | 'stopping'; drainDelayMs: number } = {
    phase: 'starting',
    drainDelayMs: 0,
  };
  const logger = container.get(Services.Logger);
  const shutdown = shutdownOnce({
    graceMs: timings.graceMs,
    get drainDelayMs() {
      return lifecycle.drainDelayMs;
    },
    drain: () => {
      lifecycle.drainDelayMs = lifecycle.phase === 'listening' ? timings.drainDelayMs : 0;
      lifecycle.phase = 'stopping';
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
    log: logger,
  });
  if (signals) exitOnSignals(signals, shutdown);

  const isStopping = () => lifecycle.phase === 'stopping';
  const metricsPort = () => container.get(Services.MetricsServer).port;
  const started = await container.start();
  if (isStopping()) return { address: '', metricsPort: metricsPort(), shutdown };
  if (isErr(started)) {
    switch (started.error.type) {
      case 'interrupted':
        return { address: '', metricsPort: metricsPort(), shutdown };
      case 'failed':
        logger.error({ token: started.error.token, err: started.error.cause }, 'startup failed');
        await app.close();
        throw asThrowable(container.get(ErrorCodeRegistry), started.error.cause);
      default:
        return assertNever(started.error, 'StartupFailed');
    }
  }

  const address = await app.listen({ port: config.http.port, host: '0.0.0.0' });
  if (isStopping()) return { address, metricsPort: metricsPort(), shutdown };
  lifecycle.phase = 'listening';
  logger.info({ address, metricsPort: metricsPort() }, 'API listening');

  return { address, metricsPort: metricsPort(), shutdown };
}
