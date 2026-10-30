import { rootRouteId, useRouter } from '@tanstack/react-router';
import { recordWebVitals, type TelemetryApp } from '@vp/api-contracts';
import { fromPromise, ignore } from '@vp/result';
import { useEffect, useEffectEvent } from 'react';

export interface WebTelemetryOptions {
  app: TelemetryApp;
  apiBaseUrl: string;
  /** Unset, no tracer loads: a build that names no collector sends no spans. */
  tracesUrl: string | undefined;
}

/**
 * Starts the vitals beacon and the browser traces once the app has hydrated. Both load from dynamic
 * imports inside the effect, so the server render and the hydration bundle never carry them.
 */
export function useWebTelemetry({ app, apiBaseUrl, tracesUrl }: WebTelemetryOptions): void {
  const router = useRouter();

  const start = useEffectEvent(async () => {
    const { startWebVitals } = await import('./start-web-vitals');
    startWebVitals({
      app,
      vitalsUrl: `${apiBaseUrl}${recordWebVitals.path}`,
      routeId: () => router.state.matches.at(-1)?.routeId ?? rootRouteId,
    });
    if (tracesUrl === undefined) {
      return;
    }

    const { startWebTracing } = await import('./start-web-tracing');
    startWebTracing({
      serviceName: `taitube-${app}`,
      tracesUrl,
      apiOrigin: new URL(apiBaseUrl).origin,
    });
  });

  useEffect(() => {
    ignore(
      fromPromise(start(), (cause) => cause),
      'telemetry that fails to load leaves the page as it was, with nothing measured'
    );
  }, []);
}
