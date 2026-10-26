import type { TelemetryApp } from '@vp/api-contracts';
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { sendJsonBeacon } from './send-json-beacon';
import { createVitalsQueue } from './vitals-queue';

export interface WebVitalsOptions {
  app: TelemetryApp;
  vitalsUrl: string;
  routeId: () => string;
}

export function startWebVitals({ app, vitalsUrl, routeId }: WebVitalsOptions): void {
  const queue = createVitalsQueue(app, (batch) => sendJsonBeacon(vitalsUrl, batch));
  // LCP, CLS, FCP and TTFB measure the page the browser loaded, which a client navigation has
  // usually left by the time they are reported; INP belongs to the route the interaction was on.
  const landingRoute = routeId();
  const reportLanding = ({ name, value }: Metric) =>
    queue.add({ name, value, route: landingRoute });

  for (const onVital of [onLCP, onCLS, onFCP, onTTFB]) {
    onVital(reportLanding);
  }
  onINP(({ name, value }) => queue.add({ name, value, route: routeId() }));

  // After the onVital calls, so web-vitals reports the final LCP, CLS and INP before this flushes.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      queue.flush();
    }
  });
  window.addEventListener('pagehide', queue.flush);
}
