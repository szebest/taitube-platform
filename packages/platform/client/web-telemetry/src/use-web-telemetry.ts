import { fromPromise, ignore } from '@kit/result';
import { rootRouteId, useRouter } from '@tanstack/react-router';
import { useEffect, useEffectEvent } from 'react';

export interface VitalsEndpoint {
  /** The path beneath the API base URL that takes a batch of vitals. */
  path: string;
  /** The most vitals the endpoint takes in one batch. */
  maxBatchSize: number;
}

export interface WebTelemetryOptions {
  /** Labels each vitals batch. */
  app: string;
  /** Names the service on the spans. */
  serviceName: string;
  apiBaseUrl: string;
  vitals: VitalsEndpoint;
  /** Unset, no tracer loads: a build that names no collector sends no spans. */
  tracesUrl: string | undefined;
}

async function startTelemetry(
  { app, serviceName, apiBaseUrl, vitals, tracesUrl }: WebTelemetryOptions,
  routeId: () => string
): Promise<void> {
  const { startWebVitals } = await import('./start-web-vitals');
  startWebVitals({
    app,
    vitalsUrl: `${apiBaseUrl}${vitals.path}`,
    maxBatchSize: vitals.maxBatchSize,
    routeId,
  });
  if (tracesUrl === undefined) {
    return;
  }

  const { startWebTracing } = await import('./start-web-tracing');
  startWebTracing({
    serviceName,
    tracesUrl,
    apiOrigin: new URL(apiBaseUrl).origin,
  });
}

/**
 * Starts the vitals beacon and the browser traces once the app has hydrated. Both load from dynamic
 * imports inside the effect, so the server render and the hydration bundle never carry them.
 */
export function useWebTelemetry(options: WebTelemetryOptions): void {
  const router = useRouter();

  const start = useEffectEvent(() =>
    startTelemetry(options, () => router.state.matches.at(-1)?.routeId ?? rootRouteId)
  );

  useEffect(() => {
    ignore(
      fromPromise(start(), (cause) => cause),
      'telemetry that fails to load leaves the page as it was, with nothing measured'
    );
  }, []);
}
