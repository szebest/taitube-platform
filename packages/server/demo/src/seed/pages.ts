import { type Result, isErr, ok } from '@vp/result';
import type { z } from 'zod';
import type { Api, ApiRequest } from './api';
import type { SeedFailure } from './failure';

interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}

const MAX_PAGES = 40;
export const PAGE_LIMIT = 50;

/** Every item of a keyset-paginated list, following `nextCursor` until it runs out. */
export async function collectPages<T>(
  api: Api,
  request: (cursor: string | null) => ApiRequest,
  schema: z.ZodType<Page<T>>
): Promise<Result<T[], SeedFailure>> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const next: Result<Page<T>, SeedFailure> = await api.send(request(cursor), schema);
    if (isErr(next)) return next;
    items.push(...next.value.items);
    cursor = next.value.nextCursor ?? null;
    if (cursor === null) break;
  }
  return ok(items);
}
