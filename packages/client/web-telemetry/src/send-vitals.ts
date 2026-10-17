import type { WebVitalsBatch } from '@vp/api-contracts';
import { fromPromise, ignore } from '@vp/result';

/**
 * A string body goes as `text/plain`, a simple request with no CORS preflight, so the beacon still
 * leaves while the page unloads. `sendBeacon` refuses a body over its quota; `keepalive` is the retry.
 */
export function sendVitals(url: string, batch: WebVitalsBatch): void {
  const body = JSON.stringify(batch);
  if (navigator.sendBeacon(url, body)) {
    return;
  }

  ignore(
    fromPromise(fetch(url, { method: 'POST', body, keepalive: true }), (cause) => cause),
    'a lost batch of vitals is a gap in a histogram, and the page is leaving anyway'
  );
}
