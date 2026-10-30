import type { SortingState } from '@tanstack/react-table';
import { listAdminVideos } from '@vp/api-contracts';
import { z } from 'zod';

import type { AdminVideoFilters } from './admin-videos';
import { lenient } from './lenient';

const { status, visibility, categoryId, q, sort, order } = listAdminVideos.query.shape;

/** The moderation page's filters and sort, as its URL spells them; a value the contract refuses reads as absent. */
export const ModerationSearchSchema = z.object({
  q: lenient(q),
  status: lenient(status),
  visibility: lenient(visibility),
  categoryId: lenient(categoryId),
  sort: lenient(sort),
  order: lenient(order),
});

export const STATUS_OPTIONS = status.unwrap().options;
export const VISIBILITY_OPTIONS = visibility.unwrap().options;

export type ModerationSearch = z.output<typeof ModerationSearchSchema>;

type Sort = NonNullable<AdminVideoFilters['sort']>;

/** The sortable columns and the sort each one asks the API for. */
const SORT_COLUMNS: readonly { column: string; sort: Sort }[] = [
  { column: 'title', sort: 'title' },
  { column: 'viewsCount', sort: 'views' },
  { column: 'likesCount', sort: 'likes' },
  { column: 'createdAt', sort: 'newest' },
];

const DEFAULT_COLUMN = 'createdAt';

/** The table's sorting for the URL's sort and order. */
export function sortingOf({
  sort: current = 'newest',
  order: direction = 'desc',
}: ModerationSearch): SortingState {
  const match = SORT_COLUMNS.find(({ sort }) => sort === current);

  return [{ id: match?.column ?? DEFAULT_COLUMN, desc: direction === 'desc' }];
}

/** The URL's sort and order for what a header click left the table sorted by; none is the default. */
export function sortOf(sorting: SortingState): Pick<ModerationSearch, 'sort' | 'order'> {
  const [first] = sorting;
  const match = first && SORT_COLUMNS.find(({ column }) => column === first.id);
  if (!(first && match)) {
    return { sort: undefined, order: undefined };
  }

  return { sort: match.sort, order: first.desc ? 'desc' : 'asc' };
}
