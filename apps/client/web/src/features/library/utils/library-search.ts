import { z } from 'zod';

export const LIBRARY_TABS = ['history', 'searches', 'liked', 'comments'] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number];

const TabSchema = z
  .unknown()
  .transform((value) => LIBRARY_TABS.find((tab) => tab === value))
  .optional();

const FilterSchema = z
  .unknown()
  .transform((value) => (typeof value === 'string' && value.trim() !== '' ? value : undefined))
  .optional();

/** `/feed/history`: which tab is open (the history tab when none is named) and, on the history tab, the words its titles are filtered by. */
export const LibrarySearchSchema = z.object({
  tab: TabSchema,
  q: FilterSchema,
});
