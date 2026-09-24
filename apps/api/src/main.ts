import {
  type ProcessHost,
  type ShutdownOutcome,
  exitOnSignals,
  shutdownOnce,
} from '@vp/composition';
import { loadEnv } from '@vp/config';
import { type AppConfig, toAppConfig } from '@vp/env-schema';
import { asThrowable } from '@vp/errors';
import { type Logger, createLogger } from '@vp/logger';
import { type Tracing, registeredTracing } from '@vp/observability';
import { assertNever, fromPromise, ignore, isErr } from '@vp/result';
import { type ComposedApp, composeApp } from './app';
import { Services } from './composition/services.module';

/**
 * `infra/k8s/base/api.yaml` gives the pod 30 s: a 5 s preStop, then SIGTERM. The drain delay
 * keeps the listener open while readiness reads 503, and the grace window ends 5 s before the
 * kubelet's SIGKILL so a wedged disposer is named in the log rather than killed silently.
 */
export const API_SHUTDOWN = { drainDelayMs: 2_000, graceMs: 20_000 } as const;

export interface ApiProcess {
  address: string;
  metricsPort: number;
  shutdown: () => Promise<ShutdownOutcome>;
}

export interface ServeOptions {
  tracing: Tracing;
  timings?: { drainDelayMs: number; graceMs: number };
  /** Given by `main`, so its signal handlers are in before the container starts. */
  signals?: ProcessHost;
}

export async function serve(
  { app, container }: ComposedApp,
  config: AppConfig,
  { tracing, timings = API_SHUTDOWN, signals }: ServeOptions
): Promise<ApiProcess> {
  const lifecycle: { phase: 'starting' | 'listening' | 'stopping' } = { phase: 'starting' };
  const logger = container.get(Services.Logger);
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
    log: logger,
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
        logger.error({ token: started.error.token, err: started.error.cause }, 'startup failed');
        await app.close();
        throw asThrowable(started.error.cause);
      default:
        return assertNever(started.error, 'StartupFailed');
    }
  }

  const address = await app.listen({ port: config.http.port, host: '0.0.0.0' });
  lifecycle.phase = 'listening';
  logger.info({ address, metricsPort: metricsPort() }, 'API listening');

  return { address, metricsPort: metricsPort(), shutdown };
}

export async function main(host: ProcessHost): Promise<ApiProcess> {
  const config = toAppConfig(loadEnv(host.env));
  return serve(await composeApp({ config }), config, { tracing: registeredTracing, signals: host });
}

/** `log` is for a start that fails before the app has a logger of its own. */
export function run(host: ProcessHost, log: Logger): Promise<void> {
  return main(host).then(
    () => undefined,
    (err) => {
      log.fatal({ err }, 'api could not start');
      host.exit(1);
    }
  );
}

if (process.env.NODE_ENV !== 'test') {
  const host: ProcessHost = {
    env: process.env,
    onSignal: (signal, handler) => process.on(signal, handler),
    exit: (code) => process.exit(code),
  };
  void run(host, createLogger({ service: 'vp-api', level: 'info', format: 'json' }));
}
