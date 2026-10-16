import { rootRouteId, useRouter } from '@tanstack/react-router';
import { type TelemetryApp, recordWebVitals } from '@vp/api-contracts';
import { useEffect, useEffectEvent } from 'react';

export interface WebTelemetryOptions {
  app: TelemetryApp;
  apiBaseUrl: string;
  tracesUrl: string;
}

/**
 * Starts the vitals beacon and the browser traces once the app has hydrated. Both load from dynamic
 * imports inside the effect, so the server render and the hydration bundle never carry them.
 */
export function useWebTelemetry({ app, apiBaseUrl, tracesUrl }: WebTelemetryOptions): void {
  const router = useRouter();

  const start = useEffectEvent(async () => {
    const [{ startWebVitals }, { startWebTracing }] = await Promise.all([
      import('./start-web-vitals'),
      import('./start-web-tracing'),
    ]);

    startWebVitals({
      app,
      vitalsUrl: `${apiBaseUrl}${recordWebVitals.path}`,
      routeId: () => router.state.matches.at(-1)?.routeId ?? rootRouteId,
    });
    startWebTracing({
      serviceName: `taitube-${app}`,
      tracesUrl,
      apiOrigin: new URL(apiBaseUrl).origin,
    });
  });

  useEffect(() => {
    void start();
  }, []);
}
