const URL_IN_MESSAGE = /https?:\/\/[^\s'")]+/;
const RETRY_PARAM = 'vp-retry';

/**
 * The URL a failed dynamic import names in its message, which Chrome and Firefox include and Safari
 * does not: the one place that reads it, since a retry needs the address the browser gave up on.
 */
export function moduleUrlOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  return URL_IN_MESSAGE.exec(String(Reflect.get(error, 'message')))?.[0];
}

/** The same chunk under a URL no cache has seen fail, since a browser remembers a failed module fetch. */
export function retryUrl(url: string, attempt: number): string {
  const busted = new URL(url);
  busted.searchParams.set(RETRY_PARAM, String(attempt));
  return busted.toString();
}
