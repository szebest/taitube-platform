import type { Result } from '@vp/result';
import type { z } from 'zod';
import type { Actor, Api } from '../api';
import type { SeedFailure } from '../failure';
import { PAGE_LIMIT, collectPages } from '../pages';
import { CreatorLibrarySchema, type VideoSummarySchema } from '../responses';

export type LibraryVideo = z.infer<typeof VideoSummarySchema>;

/** The videos an owner's studio library lists, every page of it. */
export function listLibrary(api: Api, actor: Actor): Promise<Result<LibraryVideo[], SeedFailure>> {
  return collectPages(
    api,
    (cursor) => ({
      actor,
      method: 'GET',
      path: '/v1/creator/videos',
      query: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    }),
    CreatorLibrarySchema
  );
}
