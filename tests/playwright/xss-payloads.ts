export const XSS_PAYLOADS = [
  {
    kind: 'a script tag',
    payload: `<script>window.__xss = 'script'</script>`,
    live: '<script>window.__xss',
  },
  {
    kind: 'an onerror handler',
    payload: `<img src="x" onerror="window.__xss = 'onerror'">`,
    live: '<img src="x"',
  },
  {
    kind: 'a javascript: URL',
    payload: `javascript:window.__xss = 'url'`,
    live: 'href="javascript:',
  },
  {
    kind: 'an attribute breakout',
    payload: `"><svg onload="window.__xss = 'svg'">`,
    live: '<svg onload',
  },
] as const;

export const HOSTILE_TEXT = XSS_PAYLOADS.map(({ payload }) => payload).join(' ');

const HALF = XSS_PAYLOADS.length / 2;

export const HOSTILE_CHANNEL_NAMES = {
  creator: XSS_PAYLOADS.slice(0, HALF)
    .map(({ payload }) => payload)
    .join(' '),
  viewer: XSS_PAYLOADS.slice(HALF)
    .map(({ payload }) => payload)
    .join(' '),
};
