import { CREATOR_LIBRARY_SORTS } from '@vp/domain';
import { z } from 'zod';

const FIRST_PAGE = 1;

export const LibrarySearchSchema = z.object({
  sort: z
    .unknown()
    .optional()
    .transform((sort) => CREATOR_LIBRARY_SORTS.find((known) => known === sort) ?? 'newest'),
  page: z
    .unknown()
    .optional()
    .transform((page) => {
      const number = Number(page);
      return Number.isInteger(number) && number >= FIRST_PAGE ? number : FIRST_PAGE;
    }),
  q: z
    .unknown()
    .optional()
    .transform((q) => (typeof q === 'string' ? q : undefined)),
});

type LibrarySearch = z.output<typeof LibrarySearchSchema>;
export type LibrarySort = LibrarySearch['sort'];
