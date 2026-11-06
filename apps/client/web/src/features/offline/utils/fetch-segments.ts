import { fromPromise } from '@vp/result';
import { type FetchedEntry, sizeOf } from './put-all';

/**
 * Fetches `urls` in order and stops at the first that fails or would pass `budget` bytes, so what
 * comes back is always a playable prefix.
 */
export async function fetchSegments(
  fetcher: typeof fetch,
  urls: string[],
  budget: number
): Promise<FetchedEntry[]> {
  const fetched: FetchedEntry[] = [];
  let spent = 0;

  for (const url of urls) {
    const read = await fromPromise(
      async () => {
        const response = await fetcher(url);
        return response.ok
          ? { url, body: await response.arrayBuffer(), type: response.headers.get('content-type') }
          : undefined;
      },
      (cause) => cause
    );
    const segment = read.ok ? read.value : undefined;
    if (!segment || spent + sizeOf(segment) > budget) {
      break;
    }
    spent += sizeOf(segment);
    fetched.push(segment);
  }

  return fetched;
}
