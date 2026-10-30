import { CREATOR_LIBRARY_SORTS } from '@vp/domain';
import { z } from 'zod';

export const LibrarySearchSchema = z.object({
  sort: z.enum(CREATOR_LIBRARY_SORTS).default('newest').catch('newest'),
  page: z.coerce.number<number>().int().min(1).default(1).catch(1),
  q: z.string().optional().catch(undefined),
});

type LibrarySearch = z.output<typeof LibrarySearchSchema>;
export type LibrarySort = LibrarySearch['sort'];
