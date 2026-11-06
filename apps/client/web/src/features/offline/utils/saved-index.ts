import { fromPromise } from '@vp/result';
import { z } from 'zod';
import type { SavedEntry } from './put-all';
import { type SavedVideo, SavedVideoSchema } from './saved-video';

const INDEX_PATH = '/_saved/index.json';

const IndexSchema = z.array(SavedVideoSchema);

/** The record of saved videos: one JSON entry in the saved cache, under a path no request ever asks for. */
export async function readSavedIndex(cache: Pick<Cache, 'match'>): Promise<SavedVideo[]> {
  const response = await cache.match(INDEX_PATH);
  if (!response) {
    return [];
  }

  const body = await fromPromise(
    (): Promise<unknown> => response.json(),
    (cause) => cause
  );
  const parsed = IndexSchema.safeParse(body.ok ? body.value : undefined);
  return parsed.success ? parsed.data : [];
}

export function savedIndexEntry(videos: SavedVideo[]): SavedEntry {
  return { url: INDEX_PATH, body: JSON.stringify(videos), type: 'application/json' };
}
