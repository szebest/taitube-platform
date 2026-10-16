import type { TelemetryApp } from '@vp/api-contracts';
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { sendVitals } from './send-vitals';
import { createVitalsQueue } from './vitals-queue';

export interface WebVitalsOptions {
  app: TelemetryApp;
  vitalsUrl: string;
  /** The route id the page is on when a vital is reported. */
  routeId: () => string;
}

export function startWebVitals({ app, vitalsUrl, routeId }: WebVitalsOptions): void {
  const queue = createVitalsQueue(app, (batch) => sendVitals(vitalsUrl, batch));
  const report = ({ name, value }: Metric) => queue.add({ name, value, route: routeId() });

  for (const onVital of [onLCP, onINP, onCLS, onFCP, onTTFB]) {
    onVital(report);
  }

  // After the onVital calls, so web-vitals reports the final LCP, CLS and INP before this flushes.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      queue.flush();
    }
  });
  window.addEventListener('pagehide', queue.flush);
}
