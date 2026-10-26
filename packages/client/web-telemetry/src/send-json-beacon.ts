import { fromPromise, ignore } from '@vp/result';

/**
 * A string body goes as `text/plain`, a simple request with no CORS preflight, so the beacon still
 * leaves while the page unloads. `sendBeacon` refuses a body over its quota; `keepalive` is the retry.
 */
export function sendJsonBeacon(url: string, payload: object): void {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon(url, body)) {
    return;
  }

  ignore(
    fromPromise(fetch(url, { method: 'POST', body, keepalive: true }), (cause) => cause),
    'a lost beacon is a gap in a metric, and the page is leaving anyway'
  );
}
