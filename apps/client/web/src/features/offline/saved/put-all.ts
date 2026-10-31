import { type Result, err, fromPromise, ok } from '@vp/result';
import type { SaveFailure } from './saved-video';

export interface SavedEntry {
  url: string;
  body: string | ArrayBuffer;
  type: string | null;
}

export interface FetchedEntry extends SavedEntry {
  body: ArrayBuffer;
}

const encoder = new TextEncoder();

export function sizeOf({ body }: SavedEntry): number {
  return typeof body === 'string' ? encoder.encode(body).byteLength : body.byteLength;
}

function failureOf(cause: unknown): SaveFailure {
  return cause instanceof DOMException && cause.code === DOMException.QUOTA_EXCEEDED_ERR
    ? { reason: 'quota' }
    : { reason: 'failed' };
}

/** Stores every entry or none: a failed write deletes what the call already stored. */
export async function putAll(
  cache: Pick<Cache, 'put' | 'delete'>,
  entries: SavedEntry[]
): Promise<Result<void, SaveFailure>> {
  const stored: string[] = [];

  for (const { url, body, type } of entries) {
    const response = new Response(body, type ? { headers: { 'content-type': type } } : {});
    const put = await fromPromise(cache.put(url, response), failureOf);
    if (!put.ok) {
      await Promise.all(stored.map((key) => cache.delete(key)));
      return err(put.error);
    }
    stored.push(url);
  }

  return ok();
}
